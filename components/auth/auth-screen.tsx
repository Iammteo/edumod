"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/marketing/brand";
import { authClient, signIn, signUp, type AccountType } from "@/lib/auth/client";
import { registerOrganization, studentLogin, staffLogin } from "@/lib/actions/people";

const ROLES: { key: AccountType; label: string; icon: React.ReactNode }[] = [
  { key: "student", label: "Student", icon: <><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5" /></> },
  { key: "admin", label: "Admin", icon: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h6" /></> },
  { key: "staff", label: "Staff", icon: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></> },
];

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" /></svg>;
}
function AppleIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.55 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.93-.03-.01-2.7-1.04-2.73-4.13ZM14.69 4.5c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.14 1.14.09 2.3-.58 3.01-1.43Z" /></svg>;
}
function Spinner({ light }: { light?: boolean }) {
  return <span className={`inline-block size-[18px] animate-spin rounded-full border-2 ${light ? "border-white/40 border-t-white" : "border-ink-soft/30 border-t-ink-soft"}`} />;
}

function Field({ label, name, type = "text", placeholder, autoComplete }: { label: string; name: string; type?: string; placeholder: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-extrabold text-ink">{label}</span>
      <div className="relative">
        <input name={name} type={isPw && show ? "text" : type} placeholder={placeholder} required autoComplete={autoComplete} className="min-h-11 w-full rounded-[12px] border border-border-soft bg-white px-3.5 pr-10 text-[14px] text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
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
  const router = useRouter();
  const [role, setRole] = useState<AccountType>("student");
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Signup gains an email-OTP verification step before the org is created.
  const [step, setStep] = useState<"form" | "otp">("form");
  const [pending, setPending] = useState<{ email: string; schoolName: string; state: string; country: string; address: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    setError(null);
    setSending("email");
    try {
      if (!isLogin) {
        // Step 1: create the admin account, then email a verification OTP.
        const name = String(fd.get("name") || "");
        const email = String(fd.get("email") || "");
        if (password !== String(fd.get("confirm") || "")) throw new Error("Passwords do not match.");
        const su = await signUp.email({ name, email, password, accountType: "admin" });
        if (su.error) {
          // The account may already exist from a half-finished signup. Sign in (with the same
          // password) and continue - registerOrganization is idempotent, so it completes the org.
          const si = await signIn.email({ email, password });
          if (si.error) throw new Error("An account with this email already exists. Please log in instead.");
        }
        const sent = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
        if (sent.error) throw new Error(sent.error.message || "Could not send the verification code.");
        setPending({ email, schoolName: String(fd.get("schoolName") || ""), state: String(fd.get("state") || ""), country: String(fd.get("country") || ""), address: String(fd.get("address") || "") });
        setStep("otp");
        setSending(null);
        return;
      }
      // Login
      if (role === "student") {
        const r = await studentLogin({ schoolCode: String(fd.get("schoolCode") || ""), studentId: String(fd.get("studentId") || ""), password });
        if ("error" in r) throw new Error(r.error);
        router.push("/dashboard");
        return;
      }
      if (role === "staff") {
        // Staff can sign in with their Staff ID or their email. "@" tells them apart.
        const identifier = String(fd.get("identifier") || "").trim();
        if (identifier && !identifier.includes("@")) {
          const r = await staffLogin({ staffId: identifier, password });
          if ("error" in r) throw new Error(r.error);
          router.push("/dashboard");
          return;
        }
        const res = await signIn.email({ email: identifier, password });
        if (res.error) throw new Error(res.error.message || "Invalid credentials");
        router.push("/dashboard");
        return;
      }
      const res = await signIn.email({ email: String(fd.get("email") || ""), password });
      if (res.error) throw new Error(res.error.message || "Invalid credentials");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSending(null);
    }
  }

  // Step 2: verify the OTP, then create the organization.
  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending) return;
    const otp = String(new FormData(e.currentTarget).get("otp") || "").trim();
    setError(null);
    setSending("otp");
    try {
      const v = await authClient.emailOtp.verifyEmail({ email: pending.email, otp });
      if (v.error) throw new Error(v.error.message || "Invalid or expired code.");
      const r = await registerOrganization({ schoolName: pending.schoolName, state: pending.state, country: pending.country, address: pending.address });
      if ("error" in r) throw new Error(r.error);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code. Please try again.");
      setSending(null);
    }
  }

  async function resendOtp() {
    if (!pending) return;
    setError(null);
    setSending("resend");
    try {
      await authClient.emailOtp.sendVerificationOtp({ email: pending.email, type: "email-verification" });
    } finally {
      setSending(null);
    }
  }

  async function social(provider: "google" | "apple") {
    setError(null);
    setSending(provider);
    try {
      await signIn.social({ provider, callbackURL: "/dashboard" });
    } catch {
      setError(`Could not connect to ${provider === "google" ? "Google" : "Apple"}. It may not be configured yet.`);
      setSending(null);
    }
  }

  const showSocial = isLogin && role !== "student";

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
            <h2 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-.03em]">{isLogin ? "Welcome back to clarity." : "Set up your school in minutes."}</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-blue-100">{isLogin ? "Sign in to pick up where you left off - attendance, finance, results and communication, all in one place." : "Create your organization, then invite your staff and add students from your dashboard."}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {["Attendance", "Finance", "Results", "Communication", "Audit trail"].map((t, i) => <span key={t} style={{ animationDelay: `${i * 0.12}s` }} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold backdrop-blur motion-safe:animate-[fade-up_.6s_ease_both]">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-paper px-5 py-12 sm:px-10">
        <Link href="/" className="absolute left-5 top-5 text-[12px] font-bold text-ink-soft transition hover:text-brand-blue sm:left-8 sm:top-8"><span aria-hidden>←</span> Back to home</Link>
        <div className="w-full max-w-[404px] motion-safe:animate-[fade-up_.6s_ease]">
          <div className="mb-7 lg:hidden"><Logo /></div>
          {!isLogin && step === "otp" ? (
            <div>
              <h1 className="font-display text-[30px] font-extrabold tracking-[-.03em]">Verify your email</h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">We sent a 6-digit code to <strong className="text-ink">{pending?.email}</strong>. Enter it to finish creating your school.</p>
              {error && <div className="mt-5 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e]">{error}</div>}
              <form onSubmit={onVerify} className="mt-5 grid gap-3.5">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-extrabold text-ink">Verification code</span>
                  <input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required placeholder="••••••" className="min-h-12 rounded-[12px] border border-border-soft bg-white px-3.5 text-center text-[20px] font-extrabold tracking-[0.4em] text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
                </label>
                <button type="submit" disabled={!!sending} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.22)] transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{sending === "otp" ? <Spinner light /> : "Verify & create school"}</button>
              </form>
              <div className="mt-4 flex items-center justify-between text-[12px]">
                <button type="button" onClick={() => { setStep("form"); setError(null); }} className="font-bold text-ink-soft transition hover:text-brand-blue"><span aria-hidden>←</span> Back</button>
                <button type="button" onClick={resendOtp} disabled={!!sending} className="font-extrabold text-brand-blue hover:underline disabled:opacity-60">{sending === "resend" ? "Sending…" : "Resend code"}</button>
              </div>
            </div>
          ) : (
          <>
          <h1 className="font-display text-[30px] font-extrabold tracking-[-.03em]">{isLogin ? "Welcome back" : "Create your organization"}</h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            {isLogin ? "New school? " : "Already have an account? "}
            <Link href={isLogin ? "/signup" : "/login"} className="font-extrabold text-brand-blue hover:underline">{isLogin ? "Create an organization" : "Log in"}</Link>
          </p>

          {/* Role selector (login only) */}
          {isLogin && (
            <div className="mt-6">
              <span className="text-[12px] font-extrabold text-ink">I&rsquo;m logging in as</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ROLES.map((r) => {
                  const active = role === r.key;
                  return (
                    <button type="button" key={r.key} onClick={() => { setRole(r.key); setError(null); }} aria-pressed={active} className={`flex flex-col items-center gap-1.5 rounded-[12px] border px-2 py-3 text-center text-[11px] font-extrabold transition ${active ? "border-brand-blue bg-brand-soft text-brand-blue shadow-[0_6px_16px_rgba(33,89,232,.12)]" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue/40"}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">{r.icon}</svg>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showSocial && (
            <>
              <div className="mt-5 grid gap-2.5">
                <button onClick={() => social("google")} disabled={!!sending} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[12px] border border-border-soft bg-white px-4 text-[14px] font-extrabold text-ink transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-[0_8px_20px_rgba(16,33,63,.08)] disabled:opacity-60">{sending === "google" ? <Spinner /> : <GoogleIcon />} Continue with Google</button>
                <button onClick={() => social("apple")} disabled={!!sending} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[12px] border border-border-soft bg-white px-4 text-[14px] font-extrabold text-ink transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-[0_8px_20px_rgba(16,33,63,.08)] disabled:opacity-60">{sending === "apple" ? <Spinner /> : <AppleIcon />} Continue with Apple</button>
              </div>
              <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-ink-soft"><span className="h-px flex-1 bg-border-soft" />or with email<span className="h-px flex-1 bg-border-soft" /></div>
            </>
          )}

          {error && <div className={`${showSocial ? "" : "mt-6"} mb-4 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e] motion-safe:animate-[fade-up_.3s_ease]`}>{error}</div>}

          <form onSubmit={onSubmit} className={`grid gap-3.5 ${showSocial ? "" : "mt-6"}`}>
            {!isLogin && <>
              <Field label="Your name" name="name" placeholder="Jane Adeyemi" autoComplete="name" />
              <Field label="School name" name="schoolName" placeholder="Royal Crest Academy" />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="State" name="state" placeholder="Lagos" />
                <Field label="Country" name="country" placeholder="Nigeria" />
              </div>
              <Field label="Address" name="address" placeholder="12 School Road, Ikeja" />
              <Field label="Work email" name="email" type="email" placeholder="you@school.edu.ng" autoComplete="email" />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" />
                <Field label="Confirm password" name="confirm" type="password" placeholder="Re-enter password" autoComplete="new-password" />
              </div>
            </>}

            {isLogin && role === "student" && <>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="School code" name="schoolCode" placeholder="RCA" />
                <Field label="Student ID" name="studentId" placeholder="2623844" />
              </div>
              <Field label="Password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
            </>}

            {isLogin && role === "staff" && <>
              <Field label="Email or Staff ID" name="identifier" type="text" placeholder="you@school.edu.ng or SIS482147" autoComplete="username" />
              <div>
                <Field label="Password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
                <div className="mt-1.5 text-right"><Link href="/forgot-password" className="text-[12px] font-bold text-brand-blue hover:underline">Forgot password?</Link></div>
              </div>
            </>}

            {isLogin && role === "admin" && <>
              <Field label="Email" name="email" type="email" placeholder="you@school.edu.ng" autoComplete="email" />
              <div>
                <Field label="Password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
                <div className="mt-1.5 text-right"><Link href="/forgot-password" className="text-[12px] font-bold text-brand-blue hover:underline">Forgot password?</Link></div>
              </div>
            </>}

            <button type="submit" disabled={!!sending} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.22)] transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{sending === "email" ? <Spinner light /> : (isLogin ? "Log in" : "Create organization")}</button>
          </form>

          {!isLogin && <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">Signing up creates an <strong className="text-ink">admin</strong> account. We&rsquo;ll email you a unique <strong className="text-ink">school code</strong> - staff and students use it to log in. Add them later from your dashboard.</p>}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-soft">By continuing you agree to Edumod&rsquo;s <Link className="underline hover:text-brand-blue" href="/terms">Terms</Link> and <Link className="underline hover:text-brand-blue" href="/privacy">Privacy Policy</Link>.</p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
