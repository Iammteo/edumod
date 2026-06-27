import nodemailer from "nodemailer";

// Single outbound-email seam. Transport priority: SMTP (e.g. Gmail) → Resend → console.
// In dev it also logs the email so codes/links are always visible. Server-only.
type Mail = { to: string; subject: string; text: string };

const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.RESEND_FROM || "Edumod <onboarding@resend.dev>";

let transporter: nodemailer.Transporter | null = null;
function smtp(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true, // reuse connections so repeat sends skip the TLS/auth handshake
      maxConnections: 3,
    });
  }
  return transporter;
}

export async function sendEmail(mail: Mail): Promise<void> {
  const tx = smtp();
  const hasResend = !!process.env.RESEND_API_KEY;

  // Always log in dev (and whenever no transport is configured) so links are reachable.
  if (process.env.NODE_ENV !== "production" || (!tx && !hasResend)) {
    console.info(`[email:dev] to=${mail.to} | ${mail.subject}\n${mail.text}\n`);
  }

  try {
    if (tx) {
      await tx.sendMail({ from: FROM, to: mail.to, subject: mail.subject, text: mail.text });
      return;
    }
    if (hasResend) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: mail.to, subject: mail.subject, text: mail.text }),
      });
      if (!res.ok) console.error(`[email] Resend failed (${res.status}): ${await res.text()}`);
    }
  } catch (e) {
    console.error("[email] send failed:", e);
  }
}

export async function sendSchoolCodeEmail(to: string, schoolName: string, schoolCode: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Your Edumod school code for ${schoolName}`,
    text: [
      `Welcome to Edumod!`,
      ``,
      `Your school code is: ${schoolCode}`,
      ``,
      `Share this code with your staff and students — they'll need it to log in.`,
      `You can always find it again in your school settings.`,
    ].join("\n"),
  });
}
