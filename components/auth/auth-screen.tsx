"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/marketing/brand";

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" /></svg>;
}
function AppleIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.55 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.93-.03-.01-2.7-1.04-2.73-4.13ZM14.69 4.5c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.14 1.14.09 2.3-.58 3.01-1.43Z" /></svg>;
}
function Spinner({ light }: { light?: boolean }) {
  return <span className={`inline-block size-[18px] animate-spin rounded-full border-2 ${light ? "border-white/40 border-t-white" : "border-ink-soft/30 border-t-ink-soft"}`} />;
}

function AuthField({ label, type, placeholder, autoComplete }: { label: string; type: string; placeholder: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-extrabold text-ink">{label}</span>
      <div className="relative">
        <input type={isPw && show ? "text" : type} placeholder={placeholder} required autoComplete={autoComplete} className="min-h-11 w-full rounded-[12px] border border-border-soft bg-white px-3.5 pr-10 text-[14px] text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
        {isPw && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft transition hover:text-brand-blue">
            {show
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
        )}
      </div>
    </label>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  const [sending, setSending] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  function simulate(via: string) {
    if (sending) return;
    setSending(via);
    setTimeout(() => { setSending(null); setDone(true); setTimeout(() => setDone(false), 2400); }, 1000);
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); simulate("email"); }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Animated graphic panel (hidden on mobile) */}
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#0d2f75,#2159e8,#1b4fd0,#143a99)] bg-[length:220%_220%] motion-safe:animate-[gradient-shift_14s_ease_infinite] lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="absolute -left-16 top-10 size-72 rounded-full bg-white/15 blur-3xl motion-safe:animate-[blob_16s_ease-in-out_infinite]" />
          <span className="absolute -right-10 top-1/3 size-80 rounded-full bg-brand-green/25 blur-3xl motion-safe:animate-[blob_22s_ease-in-out_infinite]" />
          <span className="absolute bottom-0 left-1/4 size-72 rounded-full bg-[#5d85ef]/30 blur-3xl motion-safe:animate-[blob_18s_ease-in-out_infinite]" />
          <span className="absolute left-1/2 top-1/2 size-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/15 motion-safe:animate-[spin-slow_40s_linear_infinite]" />
        </div>
        <div className="relative z-10 flex h-full flex-col p-12 text-white">
          <Link href="/" aria-label="Edumod home"><Logo inverse /></Link>
          <div className="mt-auto">
            <h2 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-.03em]">{isLogin ? "Welcome back to clarity." : "Run your school with clarity."}</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-blue-100">{isLogin ? "Sign in to pick up where you left off — attendance, finance, results and communication, all in one place." : "Join the schools bringing administration, finance and academics into one trusted, modern platform."}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {["Attendance", "Finance", "Results", "Communication", "Audit trail"].map((t, i) => <span key={t} style={{ animationDelay: `${i * 0.12}s` }} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold backdrop-blur motion-safe:animate-[fade-up_.6s_ease_both]">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-paper px-5 py-12 sm:px-10">
        <Link href="/" className="absolute left-5 top-5 text-[12px] font-bold text-ink-soft transition hover:text-brand-blue sm:left-8 sm:top-8"><span aria-hidden>←</span> Back to home</Link>
        <div className="w-full max-w-[400px] motion-safe:animate-[fade-up_.6s_ease]">
          <div className="mb-7 lg:hidden"><Logo /></div>
          <h1 className="font-display text-[30px] font-extrabold tracking-[-.03em]">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">{isLogin ? "New to Edumod? " : "Already have an account? "}<Link href={isLogin ? "/signup" : "/login"} className="font-extrabold text-brand-blue hover:underline">{isLogin ? "Create an account" : "Log in"}</Link></p>

          <div className="mt-7 grid gap-2.5">
            <button onClick={() => simulate("google")} disabled={!!sending} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[12px] border border-border-soft bg-white px-4 text-[14px] font-extrabold text-ink transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-[0_8px_20px_rgba(16,33,63,.08)] disabled:opacity-60">{sending === "google" ? <Spinner /> : <GoogleIcon />} Continue with Google</button>
            <button onClick={() => simulate("apple")} disabled={!!sending} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[12px] border border-border-soft bg-white px-4 text-[14px] font-extrabold text-ink transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-[0_8px_20px_rgba(16,33,63,.08)] disabled:opacity-60">{sending === "apple" ? <Spinner /> : <AppleIcon />} Continue with Apple</button>
          </div>

          <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-ink-soft"><span className="h-px flex-1 bg-border-soft" />or with email<span className="h-px flex-1 bg-border-soft" /></div>

          <form onSubmit={onSubmit} className="grid gap-3.5">
            {!isLogin && <AuthField label="Full name" type="text" placeholder="Jane Adeyemi" autoComplete="name" />}
            <AuthField label="Email" type="email" placeholder="you@school.edu.ng" autoComplete="email" />
            <div>
              <AuthField label="Password" type="password" placeholder="••••••••" autoComplete={isLogin ? "current-password" : "new-password"} />
              {isLogin && <div className="mt-1.5 text-right"><a href="#" className="text-[12px] font-bold text-brand-blue hover:underline">Forgot password?</a></div>}
            </div>
            <button type="submit" disabled={!!sending} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.22)] transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{sending === "email" ? <Spinner light /> : (isLogin ? "Log in" : "Create account")}</button>
          </form>

          {done && <div className="mt-4 flex items-center justify-center gap-2 rounded-[12px] bg-brand-green/10 px-4 py-2.5 text-[13px] font-bold text-brand-green motion-safe:animate-[fade-up_.4s_ease]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="m5 13 4 4L19 7" /></svg>{isLogin ? "Signed in" : "Account created"} (demo)</div>}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-soft">By continuing you agree to Edumod&rsquo;s <a className="underline hover:text-brand-blue" href="#">Terms</a> and <a className="underline hover:text-brand-blue" href="#">Privacy Policy</a>.</p>
        </div>
      </div>
    </div>
  );
}
