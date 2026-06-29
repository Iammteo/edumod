"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyAttendance, selfClockIn, handleQrClockIn, setClockInPin, type MyAttendance } from "@/lib/actions/attendance";
import { saveStudentResult } from "@/lib/actions/students";
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
  async function clock() { setBusy(true); setErr(null); const r = await selfClockIn(); setBusy(false); if ("error" in r) setErr(r.error); else { flash(`${r.direction === "clock_in" ? "Clocked in" : "Clocked out"} at ${r.at}`); load(); } }
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
        <button onClick={clock} disabled={busy} className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-[10px] border border-border-soft bg-white text-[12px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">{busy ? "Working…" : `No terminal nearby? ${inNow ? "Clock out" : "Clock in"} here`}</button>
      </div>
      {ok && <p className="text-[12px] font-bold text-brand-green">{ok} ✓</p>}
      {err && <p className="text-[12px] font-bold text-[#b3261e]">{err}</p>}

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold text-ink-soft">Recent</span>
        <button onClick={() => setShowPin((v) => !v)} className="text-[11px] font-extrabold text-brand-blue hover:underline">{data.pinSet ? "Change kiosk PIN" : "Set kiosk PIN"}</button>
      </div>
      {showPin && <PinSetup mySet={data.pinSet} onDone={() => { setShowPin(false); load(); }} />}
      {data.history.length === 0 ? <p className="text-[12px] text-ink-soft">No clock-ins yet. Tap “Clock in”, or scan the terminal QR.</p> : (
        <ul className="grid gap-1.5">{data.history.map((h, i) => <li key={i} className="flex items-center justify-between rounded-lg border border-border-soft px-3 py-1.5 text-[11px]"><span className={`font-extrabold ${h.direction === "clock_in" ? "text-brand-green" : "text-[#b9540f]"}`}>{h.direction === "clock_in" ? "In" : "Out"}</span><span className="text-ink-soft">{h.date} · {h.time}</span><span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{METHOD[h.method] ?? h.method}</span></li>)}</ul>
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
      {err && <p className="text-[11px] font-bold text-[#b3261e]">{err}</p>}
      <button onClick={save} disabled={busy} className="inline-flex min-h-9 w-fit items-center rounded-[9px] bg-brand-blue px-4 text-[12px] font-extrabold text-white disabled:opacity-60">{busy ? "Saving…" : "Save PIN"}</button>
    </div>
  );
}

/* ---------- Record results for my class ---------- */
export function RecordResults({ classStudents }: { classStudents: { id: string; name: string; admissionNo: string }[] }) {
  const [studentId, setStudentId] = useState("");
  const [term, setTerm] = useState(TERMS[1]);
  const [subject, setSubject] = useState("");
  const [ca, setCa] = useState(""); const [exam, setExam] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) { setMsg({ err: "Pick a student." }); return; }
    setBusy(true); setMsg(null);
    const r = await saveStudentResult({ studentId, term, subject, ca: Number(ca || 0), exam: Number(exam || 0) });
    setBusy(false);
    if ("error" in r) { setMsg({ err: r.error }); return; }
    setMsg({ ok: "Saved ✓" }); setSubject(""); setCa(""); setExam("");
  }

  if (classStudents.length === 0) return <p className="text-[12px] text-ink-soft">No students in your class yet - ask your admin to assign them.</p>;
  return (
    <form onSubmit={save} className="grid gap-2.5">
      <datalist id="subj">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Student</span><select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}><option value="">Select…</option>{classStudents.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.admissionNo})</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Term</span><select value={term} onChange={(e) => setTerm(e.target.value)} className={inputCls}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-[1.6fr_.7fr_.7fr_auto] sm:items-end">
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Subject</span><input list="subj" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Mathematics" className={inputCls} /></label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">CA /40</span><input type="number" min="0" max="40" value={ca} onChange={(e) => setCa(e.target.value)} required className={inputCls} /></label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Exam /60</span><input type="number" min="0" max="60" value={exam} onChange={(e) => setExam(e.target.value)} required className={inputCls} /></label>
        <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center justify-center rounded-[10px] bg-brand-blue px-4 text-[12px] font-extrabold text-white disabled:opacity-60">{busy ? "…" : "Save"}</button>
      </div>
      {msg?.ok && <p className="text-[12px] font-bold text-brand-green">{msg.ok}</p>}
      {msg?.err && <p className="text-[12px] font-bold text-[#b3261e]">{msg.err}</p>}
    </form>
  );
}
