"use client";

import { useCallback, useEffect, useState } from "react";
import { listDevices, approveDevice, rejectDevice, type DeviceRow } from "@/lib/actions/devices";

const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;

// Blocking, centred modal shown to approvers (admin / principal / vice-principal) while a staff member
// is waiting for a new device to be approved. It has no dismiss — the approver must Approve or Reject
// every request before they can keep using the app. Polls in the background and self-gates:
// listDevices returns an error for non-approvers, so nothing renders for them.
export function DeviceApprovalPopup() {
  const [pending, setPending] = useState<DeviceRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listDevices();
    setPending("error" in r ? [] : r.pending);
  }, []);

  useEffect(() => {
    load();
    const tick = () => { if (!document.hidden) load(); };
    const t = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  async function act(id: string, fn: (id: string) => Promise<{ ok: true } | { error: string }>) {
    setBusy(id);
    await fn(id);
    setBusy(null);
    load();
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-[min(440px,100%)] rounded-2xl border border-warn-line bg-white p-5 shadow-[0_30px_80px_rgba(16,33,63,.35)] motion-safe:animate-[pop-in_.25s_ease]">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-warn-soft text-warn">{I(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)}</span>
          <div className="min-w-0"><h2 className="font-display text-[16px] font-semibold leading-tight">New device{pending.length > 1 ? "s" : ""} awaiting approval</h2><p className="text-[12px] text-ink-soft">Approve or reject to continue — this is how you stop sign-ins from devices you don&rsquo;t recognise.</p></div>
        </div>
        <ul className="grid max-h-[45vh] gap-2 overflow-y-auto">
          {pending.map((d) => (
            <li key={d.id} className="rounded-xl border border-border-soft p-3">
              <div className="min-w-0"><div className="truncate text-[13px] font-bold text-ink">{d.staffName}</div><div className="truncate text-[11px] text-ink-soft">{d.label ?? "Unknown device"} · requested {d.createdAt}</div></div>
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => act(d.id, approveDevice)} disabled={busy === d.id} className="flex-1 rounded-lg bg-brand-green px-3 py-2 text-[12px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-50">{busy === d.id ? "…" : "Approve"}</button>
                <button onClick={() => act(d.id, rejectDevice)} disabled={busy === d.id} className="flex-1 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[12px] font-extrabold text-danger transition hover:bg-danger-soft/70 disabled:opacity-50">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
