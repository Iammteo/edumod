"use client";

import { useCallback, useEffect, useState } from "react";
import { listDevices, approveDevice, rejectDevice, revokeDevice, type DeviceRow } from "@/lib/actions/devices";
import { Button } from "./ui";

// Admin panel: approve new staff sign-in devices, and revoke trusted ones. Staff can't sign in from
// a device until it's approved here (their first/onboarding device is auto-trusted).
export function DeviceApprovals() {
  const [pending, setPending] = useState<DeviceRow[]>([]);
  const [approved, setApproved] = useState<DeviceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await listDevices();
    if ("error" in r) { setErr(r.error); setLoaded(true); return; }
    setErr(null); setPending(r.pending); setApproved(r.approved); setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, fn: (id: string) => Promise<{ ok: true } | { error: string }>) {
    setBusy(id);
    const r = await fn(id);
    setBusy(null);
    if ("error" in r) { setErr(r.error); return; }
    load();
  }

  if (!loaded) return null;
  if (err) return <div className="mb-5 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-[12px] font-bold text-danger">{err}</div>;
  // Hide entirely when there's nothing to manage, so it stays out of the way.
  if (pending.length === 0 && approved.length === 0) return null;

  return (
    <section className="mb-5 rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold">Staff device approvals{pending.length > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-danger-strong px-1.5 text-[10px] font-extrabold text-white">{pending.length}</span>}</h2>
      </div>
      {pending.length > 0 ? (
        <ul className="grid gap-2">
          {pending.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn-line bg-warn-soft p-3">
              <div className="min-w-0"><div className="truncate font-bold text-ink">{d.staffName}</div><div className="truncate text-[11px] text-ink-soft">{d.label ?? "Unknown device"} · requested {d.createdAt}</div></div>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="success" size="sm" onClick={() => act(d.id, approveDevice)} disabled={busy === d.id}>Approve</Button>
                <Button variant="danger" size="sm" onClick={() => act(d.id, rejectDevice)} disabled={busy === d.id}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-[12px] text-ink-soft">No devices awaiting approval.</p>}

      {approved.length > 0 && (
        <div className="mt-4 border-t border-border-soft pt-3">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Trusted devices</div>
          <ul className="grid gap-1.5">
            {approved.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <div className="min-w-0"><span className="font-bold text-ink">{d.staffName}</span> <span className="text-ink-soft">· {d.label ?? "Device"}{d.lastSeenAt ? ` · last used ${d.lastSeenAt}` : ""}</span></div>
                <button onClick={() => act(d.id, revokeDevice)} disabled={busy === d.id} className="shrink-0 text-[11px] font-extrabold text-danger hover:underline disabled:opacity-50">Revoke</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
