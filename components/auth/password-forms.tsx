"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/marketing/brand";
import { requestPasswordReset, resetPassword } from "@/lib/auth/client";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-paper px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -left-20 -top-10 size-72 rounded-full bg-brand-soft blur-3xl motion-safe:animate-[blob_18s_ease-in-out_infinite]" />
        <span className="absolute -right-16 bottom-0 size-80 rounded-full bg-[#e4f5ea] blur-3xl motion-safe:animate-[blob_22s_ease-in-out_infinite]" />
      </div>
      <div className="relative w-full max-w-[420px] motion-safe:animate-[fade-up_.6s_ease]">
        <Link href="/" aria-label="Edumod home" className="mb-6 inline-block"><Logo /></Link>
        <div className="rounded-[20px] border border-border-soft bg-white p-7 shadow-[0_20px_60px_rgba(16,33,63,.10)] sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, name, type = "text", placeholder, autoComplete }: { label: string; name: string; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-extrabold text-ink">{label}</span>
      <input name={name} type={type} placeholder={placeholder} required autoComplete={autoComplete} minLength={type === "password" ? 8 : undefined} className="min-h-11 rounded-[12px] border border-border-soft bg-white px-3.5 text-[14px] text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
    </label>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <button type="submit" disabled={busy} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.22)] transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{busy ? <span className="inline-block size-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white" /> : children}</button>;
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="mb-4 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e]">{message}</div>;
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") || "");
    setError(null);
    setBusy(true);
    try {
      const r = await requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (r.error) throw new Error(r.error.message || "Could not send the reset link");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-6"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg></div>
          <h1 className="font-display text-2xl font-extrabold">Check your email</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">If an account exists for that address, we&rsquo;ve sent a link to reset your password.</p>
          <Link href="/login" className="mt-5 inline-block text-[13px] font-extrabold text-brand-blue hover:underline">Back to log in</Link>
        </div>
      ) : (
        <>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-.02em]">Forgot your password?</h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">Enter your email and we&rsquo;ll send you a link to reset it.</p>
          {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={onSubmit} className="mt-5 grid gap-3.5">
            <Input label="Email" name="email" type="email" placeholder="you@school.edu.ng" autoComplete="email" />
            <Submit busy={busy}>Send reset link</Submit>
          </form>
          <Link href="/login" className="mt-5 inline-block text-[13px] font-bold text-ink-soft transition hover:text-brand-blue"><span aria-hidden>←</span> Back to log in</Link>
        </>
      )}
    </Shell>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    setError(null);
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setBusy(true);
    try {
      const r = await resetPassword({ newPassword: password, token });
      if (r.error) throw new Error(r.error.message || "Could not reset password");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      {!token ? (
        <div className="text-center">
          <h1 className="font-display text-2xl font-extrabold">Invalid or expired link</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">This password reset link is no longer valid. Please request a new one.</p>
          <Link href="/forgot-password" className="mt-5 inline-block text-[13px] font-extrabold text-brand-blue hover:underline">Request a new link</Link>
        </div>
      ) : done ? (
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-brand-green/10 text-brand-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-6"><path d="m5 13 4 4L19 7" /></svg></div>
          <h1 className="font-display text-2xl font-extrabold">Password updated</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">Your password has been reset. You can now log in with your new password.</p>
          <Link href="/login" className="mt-5 inline-block text-[13px] font-extrabold text-brand-blue hover:underline">Continue to log in</Link>
        </div>
      ) : (
        <>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-.02em]">Set a new password</h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">Choose a strong password you don&rsquo;t use elsewhere.</p>
          {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={onSubmit} className="mt-5 grid gap-3.5">
            <Input label="New password" name="password" type="password" placeholder="••••••••" autoComplete="new-password" />
            <Input label="Confirm password" name="confirm" type="password" placeholder="••••••••" autoComplete="new-password" />
            <Submit busy={busy}>Reset password</Submit>
          </form>
        </>
      )}
    </Shell>
  );
}
