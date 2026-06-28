"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { handleQrClockIn } from "@/lib/actions/attendance";

function ClockIn() {
  const token = useSearchParams().get("t") ?? "";
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ok"; direction: string; at: string } | { kind: "error"; msg: string }>({ kind: "loading" });

  useEffect(() => {
    if (!token) { setState({ kind: "error", msg: "No code found. Scan the live code on the terminal." }); return; }
    handleQrClockIn({ token }).then((r) => setState("error" in r ? { kind: "error", msg: r.error } : { kind: "ok", direction: r.direction, at: r.at }));
  }, [token]);

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6">
      <div className="w-[min(420px,100%)] rounded-2xl border border-border-soft bg-white p-7 text-center shadow-[0_20px_60px_rgba(16,33,63,.1)]">
        {state.kind === "loading" && <><Loader2 className="mx-auto size-12 animate-spin text-brand-blue" /><p className="mt-4 text-[14px] font-bold text-ink-soft">Recording your attendance…</p></>}
        {state.kind === "ok" && <><CheckCircle2 className="mx-auto size-14 text-brand-green" /><h1 className="mt-3 font-display text-[24px] font-semibold">{state.direction === "clock_in" ? "Clocked in" : "Clocked out"}</h1><p className="mt-1 text-[14px] text-ink-soft">at {state.at}. Have a great day!</p></>}
        {state.kind === "error" && <><XCircle className="mx-auto size-14 text-[#b3261e]" /><h1 className="mt-3 font-display text-[20px] font-semibold">Couldn&rsquo;t clock you in</h1><p className="mt-1 text-[14px] text-ink-soft">{state.msg}</p><Link href="/login" className="mt-4 inline-flex rounded-[10px] bg-brand-blue px-4 py-2 text-[13px] font-extrabold text-white">Sign in</Link></>}
      </div>
    </div>
  );
}

export default function ClockInPage() {
  return <Suspense fallback={null}><ClockIn /></Suspense>;
}
