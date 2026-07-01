"use client";

import { useCallback, useEffect, useState } from "react";
import { listDevices, approveDevice, rejectDevice, type DeviceRow } from "@/lib/actions/devices";

// Floating alert shown to approvers (admin / principal / vice-principal) whenever a staff member is
// waiting for a new device to be approved — so they don't have to sit on the Staff tab. Polls in the
// background and self-gates: listDevices returns an error for non-approvers, so nothing renders.
export function DeviceApprovalPopup() {
  const [pending, setPending] = useState<DeviceRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await listDevices();
    setPending("error" in r ? [] : r.pending);
  }, []);

  useEffect(() => {
    load();
    const tick = () => { if (!document.hidden) load(); };
    const t = setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  async function act(id: string, fn: (id: string) => Promise<{ ok: true } | { error: string }>) {
    setBusy(id);
    await fn(id);
    setBusy(null);
    load();
  }

  const visible = pending.filter((d) => !dismissed.has(d.id));
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-24px))] motion-safe:animate-[fade-up_.25s_ease]">
      <div className="rounded-2xl border border-warn-line bg-white p-4 shadow-[0_24px_60px_rgba(16,33,63,.28)]">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warn-soft text-warn">{I(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)}</span>
          <div className="min-w-0"><div className="font-display text-[14px] font-semibold leading-tight">New device{visible.length > 1 ? "s" : ""} awaiting approval</div><div className="text-[11px] text-ink-soft">A staff member is signing in from a device you haven&rsquo;t approved.</div></div>
        </div>
        <ul className="grid gap-2">
          {visible.slice(0, 3).map((d) => (
            <li key={d.id} className="rounded-xl border border-border-soft p-2.5">
              <div className="min-w-0"><div className="truncate text-[12px] font-bold text-ink">{d.staffName}</div><div className="truncate text-[10px] text-ink-soft">{d.label ?? "Unknown device"} · requested {d.createdAt}</div></div>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => act(d.id, approveDevice)} disabled={busy === d.id} className="flex-1 rounded-lg bg-brand-green px-2 py-1.5 text-[11px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-50">Approve</button>
                <button onClick={() => act(d.id, rejectDevice)} disabled={busy === d.id} className="flex-1 rounded-lg border border-danger-line bg-danger-soft px-2 py-1.5 text-[11px] font-extrabold text-danger transition hover:bg-danger-soft/70 disabled:opacity-50">Reject</button>
                <button onClick={() => setDismissed((p) => new Set(p).add(d.id))} title="Dismiss for now" className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-ink-soft transition hover:text-ink">Later</button>
              </div>
            </li>
          ))}
        </ul>
        {visible.length > 3 && <p className="mt-2 text-center text-[10px] text-ink-soft">+{visible.length - 3} more · open Staff → Device approvals</p>}
      </div>
    </div>
  );
}

const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;
