"use client";

import { useState } from "react";
import { saveStudentResult, deleteStudentResult, type TermResult } from "@/lib/actions/students";

const SUBJECTS = ["Mathematics", "English Language", "Basic Science", "Basic Technology", "Social Studies", "Civic Education", "Agricultural Science", "Business Studies", "Computer Studies / ICT", "Christian Religious Studies", "Islamic Religious Studies", "Physical & Health Education", "Home Economics", "Cultural & Creative Arts", "French", "Physics", "Chemistry", "Biology", "Economics", "Government", "Literature-in-English", "Geography", "Further Mathematics", "Financial Accounting", "Commerce", "Yoruba", "Hausa", "Igbo"];
const TERMS = ["2023/2024 · Term 1", "2023/2024 · Term 2", "2023/2024 · Term 3", "2024/2025 · Term 1"];
const gradeTone = (g: string) => (g === "A" ? "text-brand-green" : g === "F" ? "text-[#b3261e]" : g === "D" || g === "E" ? "text-[#b9540f]" : "text-brand-blue");
function ord(n: number) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
const inputCls = "min-h-9 w-full rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] text-ink outline-none transition focus:border-brand-blue focus:bg-white";

export function StudentResults({ studentId, academics, canManage, onChanged }: { studentId: string; academics: TermResult[]; canManage: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      {err && <div className="rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#b3261e]">{err}</div>}
      {canManage && <div className="flex justify-end"><button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border-soft bg-white px-3 py-1.5 text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft">{adding ? "✕ Close" : "＋ Record result"}</button></div>}
      {adding && <ResultForm studentId={studentId} onSaved={onChanged} onErr={setErr} />}
      {academics.length === 0 ? <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-12 text-center text-[12px] text-ink-soft">No results recorded yet.{canManage ? " Use “Record result” to add scores." : ""}</div>
        : <div className="grid gap-4 lg:grid-cols-2">{academics.map((t) => <TermSheet key={t.term} t={t} canManage={canManage} studentId={studentId} onChanged={onChanged} />)}</div>}
    </div>
  );
}

function TermSheet({ t, canManage, studentId, onChanged }: { t: TermResult; canManage: boolean; studentId: string; onChanged: () => void }) {
  async function remove(subject: string) { if (!confirm(`Remove ${subject}?`)) return; await deleteStudentResult({ studentId, term: t.term, subject }); onChanged(); }
  return (
    <div className="rounded-2xl border border-border-soft bg-white p-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="font-display text-[14px] font-semibold">{t.term}</h3>{t.position ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-extrabold text-brand-blue">{ord(t.position)} of {t.classSize}</span> : null}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-[12px]">
          <thead><tr className="border-b border-border-soft text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5 font-bold">Subject</th><th className="py-1.5 text-center font-bold">CA/40</th><th className="py-1.5 text-center font-bold">Exam/60</th><th className="py-1.5 text-center font-bold">Total</th><th className="py-1.5 text-center font-bold">Grade</th>{canManage && <th />}</tr></thead>
          <tbody>{t.subjects.map((s) => (
            <tr key={s.subject} className="border-b border-border-soft last:border-0">
              <td className="py-2 font-bold text-ink">{s.subject}</td><td className="py-2 text-center text-ink-soft">{s.ca}</td><td className="py-2 text-center text-ink-soft">{s.exam}</td><td className="py-2 text-center font-extrabold text-ink">{s.total}</td><td className={`py-2 text-center font-extrabold ${gradeTone(s.grade)}`}>{s.grade}</td>
              {canManage && <td className="py-2 text-right"><button onClick={() => remove(s.subject)} className="text-ink-soft hover:text-[#b3261e]">✕</button></td>}
            </tr>))}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper/60 px-3 py-2 text-[11px]"><span className="font-bold text-ink-soft">Total <strong className="text-ink">{t.total}</strong></span><span className="font-bold text-ink-soft">Average <strong className="text-ink">{t.average}%</strong></span><span className="font-bold text-ink-soft">Overall <strong className={gradeTone(t.grade)}>{t.grade} · {t.remark}</strong></span></div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</span>{children}</label>; }
function ResultForm({ studentId, onSaved, onErr }: { studentId: string; onSaved: () => void; onErr: (e: string | null) => void }) {
  const [term, setTerm] = useState(TERMS[1]);
  const [subject, setSubject] = useState("");
  const [ca, setCa] = useState("");
  const [exam, setExam] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); onErr(null);
    const r = await saveStudentResult({ studentId, term, subject, ca: Number(ca || 0), exam: Number(exam || 0) });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setSubject(""); setCa(""); setExam(""); onSaved();
  }
  return (
    <form onSubmit={save} className="grid gap-3 rounded-2xl border border-border-soft bg-white p-4 sm:grid-cols-[1.2fr_1.6fr_.7fr_.7fr_auto] sm:items-end">
      <F label="Term"><select value={term} onChange={(e) => setTerm(e.target.value)} className={inputCls}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></F>
      <F label="Subject"><input list="subject-list" value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputCls} placeholder="Mathematics" /><datalist id="subject-list">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist></F>
      <F label="CA /40"><input type="number" min="0" max="40" value={ca} onChange={(e) => setCa(e.target.value)} required className={inputCls} /></F>
      <F label="Exam /60"><input type="number" min="0" max="60" value={exam} onChange={(e) => setExam(e.target.value)} required className={inputCls} /></F>
      <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center justify-center rounded-[10px] bg-brand-blue px-4 text-[12px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{busy ? "…" : "Save"}</button>
    </form>
  );
}
