"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyAttendance, handleQrClockIn, setClockInPin, type MyAttendance } from "@/lib/actions/attendance";
import { saveClassResults, getClassResults } from "@/lib/actions/students";
import { Button } from "./ui";
import { QrScanModal } from "./qr-scanner";

const METHOD: Record<string, string> = { qr_scan: "QR", kiosk_pin: "PIN", admin_override: "Override", self_portal: "Portal" };
const SUBJECTS = ["Mathematics", "English Language", "Basic Science", "Basic Technology", "Social Studies", "Civic Education", "Agricultural Science", "Computer Studies / ICT", "Physics", "Chemistry", "Biology", "Economics", "Government", "Literature-in-English", "Geography", "Further Mathematics"];
const TERMS = ["2023/2024 · Term 1", "2023/2024 · Term 2", "2023/2024 · Term 3", "2024/2025 · Term 1"];
const inputCls = "min-h-9 w-full rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] text-ink outline-none focus:border-brand-blue focus:bg-white";

/* ---------- My attendance (clock in/out, status, history, PIN) ---------- */
export function MyAttendanceCard() {
  const [data, setData] = useState<MyAttendance | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => { const r = await getMyAttendance(); if (!("error" in r)) setData(r); else setErr(r.error); }, []);
  useEffect(() => { load(); }, [load]);

  function flash(m: string) { setOk(m); setErr(null); setTimeout(() => setOk((v) => (v === m ? null : v)), 3000); }
  async function onScanned(token: string) {
    setScanning(false); setBusy(true); setErr(null);
    const r = await handleQrClockIn({ token });
    setBusy(false);
    if ("error" in r) setErr(r.error); else { flash(`${r.direction === "clock_in" ? "Clocked in" : "Clocked out"} at ${r.at}`); load(); }
  }

  if (!data) return <p className="text-[12px] text-ink-soft">{err ?? "Loading…"}</p>;
  const inNow = data.status === "in";
  return (
    <div className="grid gap-3">
      {scanning && <QrScanModal onToken={onScanned} onClose={() => setScanning(false)} />}
      <div className="rounded-xl border border-border-soft bg-paper/40 p-3.5">
        <div className="flex items-center justify-between">
          <div><div className="text-[11px] font-bold text-ink-soft">Status today</div><div className={`font-display text-[18px] font-bold ${inNow ? "text-brand-green" : "text-ink"}`}>{data.status === "none" ? "Not clocked in" : inNow ? "Clocked in" : "Clocked out"}</div>{data.lastAt && <div className="text-[10px] text-ink-soft">last at {data.lastAt}</div>}</div>
        </div>
        <button onClick={() => setScanning(true)} disabled={busy} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-brand-blue text-[14px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">📷 Scan QR to {inNow ? "clock out" : "clock in"}</button>
        <p className="mt-2 text-[11px] text-ink-soft">Clock-in is verified by scanning the live QR code on the staff terminal.</p>
      </div>
      {ok && <p className="text-[12px] font-bold text-brand-green">{ok} ✓</p>}
      {err && <p className="text-[12px] font-bold text-danger">{err}</p>}

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold text-ink-soft">Recent</span>
        <button onClick={() => setShowPin((v) => !v)} className="text-[11px] font-extrabold text-brand-blue hover:underline">{data.pinSet ? "Change kiosk PIN" : "Set kiosk PIN"}</button>
      </div>
      {showPin && <PinSetup mySet={data.pinSet} onDone={() => { setShowPin(false); load(); }} />}
      {data.history.length === 0 ? <p className="text-[12px] text-ink-soft">No clock-ins yet. Scan the terminal QR code to clock in.</p> : (
        <ul className="grid gap-1.5">{data.history.map((h, i) => <li key={i} className="flex items-center justify-between rounded-lg border border-border-soft px-3 py-1.5 text-[11px]"><span className={`font-extrabold ${h.direction === "clock_in" ? "text-brand-green" : "text-warn"}`}>{h.direction === "clock_in" ? "In" : "Out"}</span><span className="text-ink-soft">{h.date} · {h.time}</span><span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{METHOD[h.method] ?? h.method}</span></li>)}</ul>
      )}
    </div>
  );
}

function PinSetup({ mySet, onDone }: { mySet: boolean; onDone: () => void }) {
  const [pin, setPin] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!/^\d{6}$/.test(pin)) { setErr("PIN must be 6 digits."); return; }
    if (pin !== confirm) { setErr("PINs don't match."); return; }
    setBusy(true); setErr(null); const r = await setClockInPin({ pin }); setBusy(false);
    if ("error" in r) { setErr(r.error); return; } onDone();
  }
  return (
    <div className="grid gap-2 rounded-xl border border-border-soft bg-paper/40 p-3">
      <p className="text-[11px] text-ink-soft">{mySet ? "Change" : "Set"} the 6-digit PIN you use at the terminal when your phone is dead.</p>
      <div className="grid grid-cols-2 gap-2">
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="New PIN" className={`${inputCls} text-center tracking-[.3em]`} />
        <input value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Confirm" className={`${inputCls} text-center tracking-[.3em]`} />
      </div>
      {err && <p className="text-[11px] font-bold text-danger">{err}</p>}
      <Button variant="primary" size="sm" onClick={save} disabled={busy} className="w-fit">{busy ? "Saving…" : "Save PIN"}</Button>
    </div>
  );
}

/* ---------- Record results for my class ---------- */
// Pick a term + subject, then enter CA/exam for the WHOLE class in one grid and save at once.
export function RecordResults({ classStudents }: { classStudents: { id: string; name: string; admissionNo: string }[] }) {
  const [term, setTerm] = useState(TERMS[1]);
  const [subject, setSubject] = useState("");
  const [scores, setScores] = useState<Record<string, { ca: string; exam: string }>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);

  const subj = subject.trim();
  const idsKey = classStudents.map((s) => s.id).join(",");

  // Prefill from any existing scores whenever the term or subject changes.
  useEffect(() => {
    if (!subj || classStudents.length === 0) { setScores({}); return; }
    let live = true;
    setLoading(true); setMsg(null);
    getClassResults({ studentIds: classStudents.map((s) => s.id), term, subject: subj }).then((map) => {
      if (!live) return;
      const next: Record<string, { ca: string; exam: string }> = {};
      for (const s of classStudents) { const e = map[s.id]; next[s.id] = { ca: e ? String(e.ca) : "", exam: e ? String(e.exam) : "" }; }
      setScores(next); setLoading(false);
    });
    return () => { live = false; };
  }, [term, subj, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function setScore(id: string, field: "ca" | "exam", val: string) {
    const digits = val.replace(/[^0-9]/g, "").slice(0, 3);
    const max = field === "ca" ? 40 : 60;
    const clamped = digits === "" ? "" : String(Math.min(Number(digits), max));
    setScores((p) => ({ ...p, [id]: { ...(p[id] ?? { ca: "", exam: "" }), [field]: clamped } }));
  }

  async function saveAll() {
    if (!subj) { setMsg({ err: "Enter a subject." }); return; }
    const entries = classStudents.map((s) => ({ studentId: s.id, ca: Number(scores[s.id]?.ca || 0), exam: Number(scores[s.id]?.exam || 0) }));
    setBusy(true); setMsg(null);
    const r = await saveClassResults({ term, subject: subj, entries });
    setBusy(false);
    if ("error" in r) { setMsg({ err: r.error }); return; }
    setMsg({ ok: `Saved ${r.count} result${r.count === 1 ? "" : "s"} ✓` });
  }

  if (classStudents.length === 0) return <p className="text-[12px] text-ink-soft">No students in your class yet - ask your admin to assign them.</p>;
  return (
    <div className="grid gap-3">
      <datalist id="subj">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Term</span><select value={term} onChange={(e) => setTerm(e.target.value)} className={inputCls}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Subject</span><input list="subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" className={inputCls} /></label>
      </div>

      {!subj ? <p className="text-[12px] text-ink-soft">Choose a subject to enter scores for the whole class at once.</p> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-ink-soft">{classStudents.length} student{classStudents.length === 1 ? "" : "s"} · <span className="text-ink">{subj}</span> · {term}{loading ? " · loading…" : ""}</span>
            <Button size="sm" onClick={saveAll} disabled={busy || loading}>{busy ? "Saving…" : "Save all"}</Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full min-w-[440px] text-left text-[12px]">
              <thead><tr className="border-b border-border-soft bg-paper/60 text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-3 py-2 font-bold">Student</th><th className="w-24 px-2 py-2 font-bold">CA /40</th><th className="w-24 px-2 py-2 font-bold">Exam /60</th><th className="w-16 px-3 py-2 text-center font-bold">Total</th></tr></thead>
              <tbody>{classStudents.map((s) => { const sc = scores[s.id] ?? { ca: "", exam: "" }; const total = (Number(sc.ca) || 0) + (Number(sc.exam) || 0); return (
                <tr key={s.id} className="border-b border-border-soft last:border-0">
                  <td className="px-3 py-1.5"><span className="font-bold text-ink">{s.name}</span> <code className="ml-1 rounded bg-brand-soft px-1 text-[10px] font-bold text-brand-blue">{s.admissionNo}</code></td>
                  <td className="px-2 py-1.5"><input inputMode="numeric" value={sc.ca} onChange={(e) => setScore(s.id, "ca", e.target.value)} className="min-h-8 w-16 rounded-lg border border-border-soft bg-paper/60 px-2 text-center outline-none focus:border-brand-blue focus:bg-white" /></td>
                  <td className="px-2 py-1.5"><input inputMode="numeric" value={sc.exam} onChange={(e) => setScore(s.id, "exam", e.target.value)} className="min-h-8 w-16 rounded-lg border border-border-soft bg-paper/60 px-2 text-center outline-none focus:border-brand-blue focus:bg-white" /></td>
                  <td className="px-3 py-1.5 text-center font-extrabold text-ink">{total || "-"}</td>
                </tr>); })}</tbody>
            </table>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={saveAll} disabled={busy || loading}>{busy ? "Saving…" : "Save all"}</Button></div>
        </>
      )}
      {msg?.ok && <p className="text-[12px] font-bold text-brand-green">{msg.ok}</p>}
      {msg?.err && <p className="text-[12px] font-bold text-danger">{msg.err}</p>}
    </div>
  );
}
