// Single outbound-email seam. Uses Resend when RESEND_API_KEY is set, otherwise logs to the
// server console (so flows are testable with no provider). Provider-agnostic: swap the body of
// sendEmail() to change providers without touching call sites. Server-only.
type Mail = { to: string; subject: string; text: string };

const FROM = process.env.RESEND_FROM || "Edumod <onboarding@resend.dev>";

export async function sendEmail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  // In dev, always log the email so codes/links are visible even when Resend can't deliver
  // (its test sender only emails your own account until you verify a domain).
  if (!key || process.env.NODE_ENV !== "production") {
    console.info(`[email:dev] to=${mail.to} | ${mail.subject}\n${mail.text}\n`);
  }
  if (!key) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[email] Resend failed (${res.status}): ${detail}`);
    }
  } catch (e) {
    console.error("[email] Resend request error:", e);
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
