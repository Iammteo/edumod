"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { twoFactor, useSession } from "@/lib/auth/client";
import { Button, Alert } from "./ui";

// Authenticator-app (TOTP) two-factor setup. Enable → scan QR + save backup codes → verify a code.
export function TwoFactorSettings() {
  const { data, refetch } = useSession();
  const enabled = !!(data?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled;

  const [mode, setMode] = useState<"idle" | "password" | "verify" | "disable">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string>("");
  const [backup, setBackup] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function reset() { setMode("idle"); setPassword(""); setCode(""); setQr(""); setBackup([]); setErr(null); }

  async function startEnable(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await twoFactor.enable({ password });
    setBusy(false);
    if (res.error) { setErr(res.error.message || "Wrong password."); return; }
    const totpURI = (res.data as { totpURI?: string })?.totpURI ?? "";
    setBackup((res.data as { backupCodes?: string[] })?.backupCodes ?? []);
    try { setQr(await QRCode.toDataURL(totpURI, { width: 200, margin: 1 })); } catch { /* show URI fallback */ }
    setMode("verify"); setPassword("");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await twoFactor.verifyTotp({ code });
    setBusy(false);
    if (res.error) { setErr(res.error.message || "Invalid code. Check your authenticator and try again."); return; }
    setOk("Two-factor authentication is on."); reset(); refetch?.();
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await twoFactor.disable({ password });
    setBusy(false);
    if (res.error) { setErr(res.error.message || "Wrong password."); return; }
    setOk("Two-factor authentication is off."); reset(); refetch?.();
  }

  const inputCls = "min-h-10 w-full rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue focus:bg-white";

  return (
    <section className="rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-[16px] font-semibold">Two-factor authentication</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${enabled ? "bg-brand-green/10 text-brand-green" : "bg-paper text-ink-soft"}`}>{enabled ? "On" : "Off"}</span>
      </div>
      <p className="mb-3 text-[12px] text-ink-soft">Require a one-time code from an authenticator app (Google Authenticator, Authy, 1Password) in addition to your password.</p>

      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      {ok && <Alert tone="success" className="mb-3">{ok}</Alert>}

      {!enabled && mode === "idle" && <Button onClick={() => { setOk(null); setMode("password"); }}>Enable 2FA</Button>}

      {!enabled && mode === "password" && (
        <form onSubmit={startEnable} className="grid max-w-sm gap-2">
          <label className="text-[11px] font-extrabold text-ink">Confirm your password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
          <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Checking…" : "Continue"}</Button><Button type="button" variant="secondary" onClick={reset}>Cancel</Button></div>
        </form>
      )}

      {!enabled && mode === "verify" && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-start gap-4">
            {qr && <img src={qr} alt="Scan with your authenticator app" className="size-[180px] rounded-xl border border-border-soft" />}
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold text-ink">1. Scan the QR with your authenticator app</div>
              <div className="mt-3 text-[12px] font-extrabold text-ink">2. Save these backup codes</div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] text-ink-soft">{backup.map((c) => <span key={c}>{c}</span>)}</div>
            </div>
          </div>
          <form onSubmit={confirm} className="grid max-w-xs gap-2">
            <label className="text-[11px] font-extrabold text-ink">3. Enter the 6-digit code</label>
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className={inputCls} />
            <div className="flex gap-2"><Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Turn on 2FA"}</Button><Button type="button" variant="secondary" onClick={reset}>Cancel</Button></div>
          </form>
        </div>
      )}

      {enabled && mode === "idle" && <Button variant="danger" onClick={() => { setOk(null); setMode("disable"); }}>Disable 2FA</Button>}
      {enabled && mode === "disable" && (
        <form onSubmit={disable} className="grid max-w-sm gap-2">
          <label className="text-[11px] font-extrabold text-ink">Confirm your password to disable</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
          <div className="flex gap-2"><Button type="submit" variant="danger" disabled={busy}>{busy ? "Disabling…" : "Disable 2FA"}</Button><Button type="button" variant="secondary" onClick={reset}>Cancel</Button></div>
        </form>
      )}
    </section>
  );
}
