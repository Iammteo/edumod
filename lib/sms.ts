// Outbound-SMS seam — a stub for now. SMS in Nigeria is pay-per-message with no free tier, so
// it's deferred and meant to be billed through to schools (see notifications.cost). When ready,
// wire a local provider (Termii / SendChamp) here behind this same signature — no call-site changes.
type Sms = { to: string; text: string };

export async function sendSms(sms: Sms): Promise<void> {
  // TODO: integrate Termii / SendChamp (naira wallet) and record per-message cost.
  console.info(`[sms:stub] to=${sms.to}\n${sms.text}\n`);
}
