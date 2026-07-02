"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { isLockedOut, recordFailure } from "@/lib/rate-limit";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bounded, validated shape for the public form. Max lengths cap the payload so it can't be abused to
// stuff huge bodies through the mailer.
const ContactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().max(254).regex(emailRe, "Please enter a valid email address."),
  school: z.string().trim().min(1, "Please enter your school.").max(160),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1, "Please enter a message.").max(5000),
});

// Best-effort client IP from the proxy headers (behind a trusted proxy in production).
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// Handles the public "Contact / Book a demo" form. Emails the team inbox so enquiries aren't lost.
// No auth (it is public), but per-IP rate limited so it can't be abused as an email-spam amplifier.
export async function submitContact(input: { name: string; email: string; school: string; phone?: string; message: string }): Promise<{ ok: true } | { error: string }> {
  // Per-IP throttle: at most MAX_ATTEMPTS submissions per rate-limit window (shared 5/5min config).
  // Fails open if Redis is unavailable (availability over strict limiting), like the rest of the app.
  const rlKey = `contact:${await clientIp()}`;
  if (await isLockedOut([rlKey])) return { error: "You've sent a few messages already. Please try again in a few minutes." };

  const parsed = ContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Please check the form and try again." };
  const { name, email, school, message } = parsed.data;
  const phone = parsed.data.phone || "-";

  // Count this submission toward the window before sending, so failed sends still can't be hammered.
  await recordFailure([rlKey]);

  const to = process.env.CONTACT_TO || process.env.SMTP_USER || process.env.MAIL_FROM || "hello@edumod.africa";
  try {
    await sendEmail({
      to,
      subject: `New Edumod enquiry - ${school}`,
      text: [`Name: ${name}`, `Email: ${email}`, `School: ${school}`, `Phone: ${phone}`, ``, `Message:`, message].join("\n"),
    });
    return { ok: true };
  } catch {
    return { error: "Something went wrong sending your message. Please try again or email us directly." };
  }
}
