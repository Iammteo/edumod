"use client";

import { useCallback, useEffect, useState } from "react";
import { listSessions, revokeSession, revokeOtherSessions, useSession } from "@/lib/auth/client";

type Sess = { id: string; token: string; ipAddress?: string | null; userAgent?: string | null; createdAt: string | Date; updatedAt?: string | Date };

function uaLabel(ua?: string | null) {
  if (!ua) return "Unknown device";
  const os = /iphone|ipad|ipod/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "Device";
  const br = /edg\//i.test(ua) ? "Edge" : /chrome\//i.test(ua) ? "Chrome" : /firefox\//i.test(ua) ? "Firefox" : /safari\//i.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

// Active-session list with per-session revoke and "sign out everywhere else". Lets a user spot and
// kill a session they don't recognise.
export function SessionManager() {
  const { data } = useSession();
  const currentToken = data?.session?.token;
  const [rows, setRows] = useState<Sess[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listSessions();
    if (!("error" in r) || !r.error) setRows((r.data as Sess[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revokeOne(token: string) { setBusy(token); await revokeSession({ token }); setBusy(null); load(); }
  async function revokeOthers() { setBusy("others"); await revokeOtherSessions(); setBusy(null); load(); }

  const others = (rows ?? []).filter((s) => s.token !== currentToken);

  return (
    <section className="rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[16px] font-semibold">Active sessions</h2>
        {others.length > 0 && <button onClick={revokeOthers} disabled={busy === "others"} className="rounded-[10px] border border-border-soft bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#b3261e] transition hover:bg-paper disabled:opacity-50">{busy === "others" ? "Signing out…" : "Sign out of all other devices"}</button>}
      </div>
      {rows === null ? <p className="text-[12px] text-ink-soft">Loading…</p> : rows.length === 0 ? <p className="text-[12px] text-ink-soft">No active sessions.</p> : (
        <ul className="grid gap-2">
          {rows.map((s) => {
            const isCurrent = s.token === currentToken;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-bold text-ink">{uaLabel(s.userAgent)}</span>{isCurrent && <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-green">This device</span>}</div>
                  <div className="text-[11px] text-ink-soft">{s.ipAddress || "Unknown IP"} · signed in {new Date(s.createdAt).toLocaleString()}</div>
                </div>
                {!isCurrent && <button onClick={() => revokeOne(s.token)} disabled={busy === s.token} className="shrink-0 text-[11px] font-extrabold text-[#b3261e] hover:underline disabled:opacity-50">Sign out</button>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-soft">If you see a session you don&rsquo;t recognise, sign it out and change your password.</p>
    </section>
  );
}
