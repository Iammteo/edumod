"use server";

import { sendEmail } from "@/lib/email";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Handles the public "Contact / Book a demo" form. Emails the team inbox so enquiries aren't lost.
export async function submitContact(input: { name: string; email: string; school: string; phone?: string; message: string }): Promise<{ ok: true } | { error: string }> {
  const name = input.name?.trim();
  const email = input.email?.trim();
  const school = input.school?.trim();
  const message = input.message?.trim();
  const phone = input.phone?.trim() || "—";
  if (!name || !email || !school || !message) return { error: "Please fill in your name, email, school and message." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  if (message.length > 5000) return { error: "Message is too long." };

  const to = process.env.CONTACT_TO || process.env.SMTP_USER || process.env.MAIL_FROM || "hello@edumod.africa";
  try {
    await sendEmail({
      to,
      subject: `New Edumod enquiry — ${school}`,
      text: [`Name: ${name}`, `Email: ${email}`, `School: ${school}`, `Phone: ${phone}`, ``, `Message:`, message].join("\n"),
    });
    return { ok: true };
  } catch {
    return { error: "Something went wrong sending your message. Please try again or email us directly." };
  }
}
