"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFinanceData, recordPayment, approvePayment, returnPayment, declinePayment, createFeeStructure, getInvoiceReport, getReceiptReport, sendInvoiceReminder, type FinanceData, type Payment, type Student, type InvoiceReportRow } from "@/lib/actions/finance";
import { formatNaira as naira, compactNaira } from "@/lib/format";
import { useAcademicTerms } from "./use-terms";
import type { ReceiptReportRow } from "@/lib/receipt";
import { getOverpayments, carryForwardCredit, requestRefund, decideRefund, type OverpaymentRow, type RefundRow } from "@/lib/actions/refunds";
import { StudentLink } from "./student-nav";
import { LoadingPanel, LoadingRows, LoadError } from "./skeleton";
import { useClassNames } from "@/components/app/use-classes";
import { ClassFinanceView } from "./class-finance";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export type FinanceSection = "record" | "approvals" | "bills" | "invoices" | "classsummary" | "overpayments" | "reports";
const SECTION_HEAD: Record<FinanceSection, [string, string]> = {
  record: ["Record payment", "Record a payment towards a student's invoice or fee."],
  approvals: ["Approvals", "Review and approve payments under maker-checker control."],
  bills: ["Bills & fee structures", "Create and issue bills to students and classes."],
  invoices: ["Invoices & receipts", "Filter, download and print invoices and receipts."],
  classsummary: ["Class finance summary", "Monitor class collections, outstanding balances and payment performance."],
  overpayments: ["Overpayments & refunds", "Track credit balances and process refunds."],
  reports: ["Report card", "Generate and share student report cards."],
};
function FinHead({ section, action }: { section: FinanceSection; action?: React.ReactNode }) {
  const [t, s] = SECTION_HEAD[section];
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="text-[11px] font-extrabold text-brand-blue">Finance overview</div><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">{t}</h1><p className="mt-0.5 text-[13px] text-ink-soft">{s}</p></div>{action}</div>;
}

export function FinanceArea({ section, onPick }: { section: FinanceSection | null; onPick: (s: FinanceSection) => void }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await getFinanceData(); if ("error" in r) setErr(r.error); else setData(r); }, []);
  useEffect(() => { if (!section) return; load(); const tick = () => { if (!document.hidden) load(); }; const t = setInterval(tick, 20000); document.addEventListener("visibilitychange", tick); return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); }; }, [load, section]);
  const flash = (m: string) => { setOk(m); setErr(null); setTimeout(() => setOk((v) => (v === m ? null : v)), 3500); };

  if (!section) return <FinanceLanding onPick={onPick} />;
  if (section === "classsummary") return <ClassFinanceView />;
  if (!data) return err ? <LoadError message={err} onRetry={load} /> : <LoadingPanel stats={5} />;

  const banners = <>{err && <div className="mb-4 rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[12px] font-bold text-danger">{err}</div>}{ok && <div className="mb-4 rounded-[12px] border border-brand-green/30 bg-brand-green/10 px-3.5 py-2.5 text-[12px] font-bold text-brand-green">{ok}</div>}</>;
  const noAccess = <div className="rounded-2xl border border-border-soft bg-paper/60 px-4 py-4 text-[12px] font-bold text-ink-soft">This action is available to an <span className="text-ink">admin, secretary, principal or vice-principal</span>.</div>;

  const goReports = <button onClick={() => onPick("classsummary")} className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-[10px] border border-border-soft bg-white px-3.5 text-[12px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue"><Chart />Go to reports</button>;
  return (
    <>
      <FinHead section={section} action={(section === "record" || section === "bills") ? goReports : undefined} />
      {banners}
      {section === "record" && (data.canRecord ? <RecordPaymentScreen data={data} onDone={(approved) => { flash(approved ? "Payment recorded and approved — receipt issued." : "Payment submitted for approval."); load(); }} onErr={setErr} /> : noAccess)}
      {section === "approvals" && <ApprovalsScreen data={data}
        onApprove={async (id) => { const r = await approvePayment(id); if ("error" in r) { setErr(r.error); return false; } flash("Payment approved - receipt issued."); load(); return true; }}
        onDecide={async (id, kind, reason) => { const r = kind === "returned" ? await returnPayment(id, reason) : await declinePayment(id, reason); if ("error" in r) { setErr(r.error); return false; } flash(kind === "returned" ? "Payment returned to the recorder." : "Payment declined."); load(); return true; }} />}
      {section === "bills" && (data.canRecord ? <IssueFeesCard data={data} onDone={(n) => { flash(`Fee issued - ${n} invoice${n === 1 ? "" : "s"} created.`); load(); }} onErr={setErr} /> : noAccess)}
      {section === "invoices" && <InvoicesReceiptsCard data={data} />}
      {section === "overpayments" && <OverpaymentsScreen onErr={setErr} onOk={flash} />}
      {section === "reports" && <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-20 text-center"><div className="mb-2 text-3xl">🛠️</div><p className="text-[14px] font-bold text-ink">Coming soon</p><p className="mt-1 text-[12px] text-ink-soft">{SECTION_HEAD["reports"][1]}</p></div>}
    </>
  );
}

// Finance landing - shown until a section is chosen. Lets any area be selected (and keeps Finance usable on mobile, where the sub-menu lives in the drawer).
const LANDING_ORDER: FinanceSection[] = ["record", "approvals", "bills", "invoices", "classsummary", "overpayments", "reports"];
function FinanceLanding({ onPick }: { onPick: (s: FinanceSection) => void }) {
  return (
    <>
      <div className="mb-5">
        <div className="text-[11px] font-extrabold text-brand-blue">Finance</div>
        <h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Finance management</h1>
        <p className="mt-0.5 text-[13px] text-ink-soft">Choose an area to get started.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LANDING_ORDER.map((sk) => {
          const [t, s] = SECTION_HEAD[sk];
          return (
            <button key={sk} onClick={() => onPick(sk)} className="group flex flex-col rounded-2xl border border-border-soft bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-sm">
              <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand-blue transition group-hover:bg-brand-blue group-hover:text-white">{landingIcon(sk)}</span>
              <span className="mt-3 font-display text-[15px] font-semibold text-ink">{t}</span>
              <span className="mt-1 text-[12px] leading-relaxed text-ink-soft">{s}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
function landingIcon(sk: FinanceSection): React.ReactNode {
  const map: Record<FinanceSection, React.ReactNode> = { record: <Card2 />, approvals: <Shield />, bills: <Doc />, invoices: <Receipt />, classsummary: <Users />, overpayments: <Wallet />, reports: <Chart /> };
  return map[sk];
}

// New two-column Record payment screen: form on the left, live student summary on the right.
function RecordPaymentScreen({ data, onDone, onErr }: { data: FinanceData; onDone: (approved: boolean) => void; onErr: (e: string) => void }) {
  const [studentId, setStudentId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [payDate, setPayDate] = useState(todayStr());
  const [bankRef, setBankRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [proofName, setProofName] = useState<string | null>(null);

  const student = data.students.find((s) => s.id === studentId) || null;
  const openForStudent = useMemo(() => data.openInvoices.filter((i) => i.studentId === studentId), [data.openInvoices, studentId]);
  const selInvoice = openForStudent.find((i) => i.id === invoiceId) || null;
  const studentInvoices = useMemo(() => data.invoices.filter((i) => i.studentId === studentId), [data.invoices, studentId]);
  const expected = studentInvoices.reduce((a, i) => a + i.amount, 0);
  const paid = studentInvoices.reduce((a, i) => a + i.paid, 0);
  const outstanding = studentInvoices.reduce((a, i) => a + i.outstanding, 0);
  const credit = studentInvoices.reduce((a, i) => a + Math.max(0, i.paid - i.amount), 0);
  const recent = data.payments.filter((p) => student && p.admissionNo === student.admissionNo).slice(0, 3);

  function pickStudent(id: string) { setStudentId(id); setInvoiceId(""); }
  function pickInvoice(id: string) { setInvoiceId(id); const inv = data.openInvoices.find((i) => i.id === id); if (inv) setAmount(String(inv.outstanding)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) { onErr("Please select a student."); return; }
    const proof = fileRef.current?.files?.[0];
    if (method === "transfer" && !proof) { onErr("Proof of payment is required for transfers."); return; }
    const desc = [bankRef.trim() && `Ref: ${bankRef.trim()}`, notes.trim()].filter(Boolean).join(" · ") || selInvoice?.description || "";
    const fd = new FormData();
    fd.set("studentId", studentId);
    if (invoiceId) fd.set("invoiceId", invoiceId);
    fd.set("amount", amount); fd.set("method", method); fd.set("description", desc);
    if (proof) fd.set("proof", proof);
    setBusy(true);
    const r = await recordPayment(fd);
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setStudentId(""); setInvoiceId(""); setAmount(""); setMethod("cash"); setBankRef(""); setNotes(""); setProofName(null); if (fileRef.current) fileRef.current.value = "";
    onDone(r.approved);
  }

  const REQ = <span className="text-danger-strong">*</span>;
  return (
    <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Left - form */}
      <section className="rounded-2xl border border-border-soft bg-white p-5">
        <h2 className="mb-4 font-display text-[16px] font-semibold">Payment details</h2>
        {data.students.length === 0 ? <p className="text-[12px] text-ink-soft">Add students first before recording payments.</p> : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<>Student {REQ}</>}><StudentPicker students={data.students} value={studentId} onChange={pickStudent} /></Field>
              <Field label={<>Invoice / Fee {REQ}</>}><select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)} disabled={!studentId} className={selectCls}><option value="">General payment (no invoice)</option>{openForStudent.map((i) => <option key={i.id} value={i.id}>{i.description} ({i.no}) - due {naira(i.outstanding)}</option>)}</select>{studentId && openForStudent.length === 0 && <p className="mt-1 text-[11px] text-ink-soft">No open invoices for this student.</p>}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<>Amount paid (₦) {REQ}</>}><div className="flex items-center rounded-[10px] border border-border-soft bg-paper/60 focus-within:border-brand-blue"><span className="grid h-10 w-9 place-items-center text-ink-soft">₦</span><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required placeholder="0" className="min-h-10 w-full rounded-r-[10px] bg-transparent pr-3 text-[13px] outline-none" /></div>{selInvoice && <p className="mt-1 text-[11px] font-bold text-ink-soft">Outstanding: <span className="text-warn">{naira(selInvoice.outstanding)}</span></p>}</Field>
              <Field label={<>Payment date {REQ}</>}><input type="date" value={payDate} max={todayStr()} onChange={(e) => setPayDate(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label={<>Payment method {REQ}</>}>
              <div className="grid grid-cols-2 gap-2.5">
                {(["cash", "transfer"] as const).map((m) => <button key={m} type="button" onClick={() => setMethod(m)} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border text-[13px] font-extrabold transition ${method === m ? "border-brand-blue bg-brand-soft text-brand-blue" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue"}`}>{m === "cash" ? <Card2 /> : <Bank />}{m === "cash" ? "Cash" : "Transfer"}</button>)}
              </div>
            </Field>
            {method === "transfer" && <Field label="Bank reference / Cheque no."><input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="e.g. GTB Ref: 1234567890" className={inputCls} /></Field>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<>Proof of payment {method === "transfer" ? <span className="text-warn">(required)</span> : <span className="font-bold text-ink-soft">(optional)</span>}</>}>
                <label className="grid cursor-pointer place-items-center gap-1 rounded-[12px] border border-dashed border-border-soft bg-paper/40 px-3 py-5 text-center transition hover:border-brand-blue"><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand-blue"><Upload /></span><span className="text-[12px] font-bold text-brand-blue">{proofName ?? "Click to upload"}<span className="font-normal text-ink-soft"> or drag and drop</span></span><span className="text-[10px] text-ink-soft">PDF, JPG, PNG (Max 5MB)</span><input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setProofName(e.target.files?.[0]?.name ?? null)} /></label>
              </Field>
              <Field label={<>Notes <span className="font-bold text-ink-soft">(optional)</span></>}><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 250))} placeholder="Add any additional information…" rows={4} className="w-full resize-none rounded-[10px] border border-border-soft bg-paper/60 px-3 py-2 text-[13px] outline-none focus:border-brand-blue focus:bg-white" /><div className="mt-0.5 text-right text-[10px] text-ink-soft">{notes.length}/250</div></Field>
            </div>
            {data.requireApproval && <div className="flex items-start gap-2.5 rounded-[12px] border border-brand-soft bg-brand-soft/40 p-3.5"><span className="mt-0.5 text-brand-blue"><Info /></span><p className="text-[11px] leading-relaxed text-ink-soft"><span className="font-extrabold text-ink">Maker-Checker in effect.</span> You are recording this payment. It will be submitted for approval and you cannot approve your own payment.</p></div>}
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70"><Send />{busy ? "Submitting…" : "Submit for approval"}</button>
          </form>
        )}
      </section>

      {/* Right - student summary */}
      <div className="grid content-start gap-[18px]">
        {!student ? <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-16 text-center text-[12px] text-ink-soft">Select a student to see their fee summary.</div> : <>
          <section className="rounded-2xl border border-border-soft bg-white p-5">
            <h2 className="mb-3 font-display text-[15px] font-semibold">Selected student summary</h2>
            <div className="flex items-center gap-3">
              {student.photoKey ? <img src={student.photoKey} alt="" className="size-12 shrink-0 rounded-full object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-full font-bold text-white" style={{ backgroundColor: AV[student.name.length % AV.length] }}>{initials(student.name)}</span>}
              <div className="min-w-0">
                <div className="flex items-center gap-2"><StudentLink studentId={student.id} name={student.name} className="truncate font-display text-[15px] font-semibold" /><span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-green">Active</span></div>
                <div className="truncate text-[11px] text-ink-soft">{student.admissionNo}{student.className ? ` · ${student.className}` : ""}</div>
                {(student.guardian || student.phone) && <div className="truncate text-[11px] text-ink-soft">{student.guardian ? `Guardian: ${student.guardian}` : ""}{student.guardian && student.phone ? " · " : ""}{student.phone ?? ""}</div>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-soft pt-3 text-center">
              <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Total expected</div><div className="mt-0.5 font-display text-[14px] font-bold text-ink">{naira(expected)}</div></div>
              <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Paid so far</div><div className="mt-0.5 font-display text-[14px] font-bold text-brand-green">{naira(paid)}</div></div>
              <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Outstanding</div><div className="mt-0.5 font-display text-[14px] font-bold text-warn">{naira(outstanding)}</div></div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3 text-[12px]"><span className="font-bold text-ink-soft">Credit balance</span><span className="font-extrabold text-brand-blue">{naira(credit)}</span></div>
          </section>

          <section className="rounded-2xl border border-border-soft bg-white p-5">
            <h3 className="mb-3 font-display text-[14px] font-semibold">Recent payments</h3>
            {recent.length === 0 ? <p className="text-[11px] text-ink-soft">No payments recorded yet.</p> : <ul className="grid gap-2">{recent.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 text-[12px]"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-brand-green/10 text-brand-green"><Card2 /></span><div><div className="font-bold text-ink">{p.date}</div><div className="text-[10px] text-ink-soft capitalize">{p.method}</div></div></div><div className="flex items-center gap-2"><span className="font-bold text-ink">{naira(p.amount)}</span><Pill tone={p.status === "approved" ? "green" : p.status === "pending_approval" ? "amber" : "red"}>{p.status === "approved" ? "Approved" : p.status === "pending_approval" ? "Pending" : "Rejected"}</Pill></div></li>)}</ul>}
          </section>

          <section className="rounded-2xl border border-border-soft bg-white p-5">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-[14px] font-semibold">Invoice / Receipt preview</h3>{(selInvoice?.id || studentInvoices[0]?.id) && <a href={`/invoice/${selInvoice?.id ?? studentInvoices[0].id}`} target="_blank" rel="noreferrer" className="text-[11px] font-extrabold text-brand-blue hover:underline">View full invoice</a>}</div>
            {studentInvoices.length === 0 ? <p className="text-[11px] text-ink-soft">No invoices for this student yet.</p> : <>
              <table className="w-full text-left text-[11px]"><thead><tr className="border-b border-border-soft text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5 font-bold">Description</th><th className="py-1.5 text-right font-bold">Amount</th></tr></thead><tbody>{studentInvoices.slice(0, 8).map((i) => <tr key={i.id} className="border-b border-border-soft last:border-0"><td className="py-1.5 font-bold text-ink">{i.description}</td><td className="py-1.5 text-right text-ink-soft">{naira(i.amount)}</td></tr>)}</tbody></table>
              <div className="mt-2 flex items-center justify-between border-t border-border-soft pt-2 text-[12px] font-extrabold"><span>Total</span><span>{naira(expected)}</span></div>
              {(selInvoice?.id || studentInvoices[0]?.id) && <a href={`/invoice/${selInvoice?.id ?? studentInvoices[0].id}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-border-soft text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft"><Download />Download PDF</a>}
            </>}
          </section>
        </>}
      </div>
    </div>
  );
}
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const AV = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0f8a8a", "#c0392b"];
const FEE_TYPES = ["Tuition", "Practical", "Lesson money", "Transport", "PTA"];

// ---------------------------------------------------------------------------- Approvals
const APPROVAL_TABS: [string, string][] = [["pending_approval", "Pending"], ["approved", "Approved"], ["returned", "Returned"], ["rejected", "Declined"]];
const stTone = (s: string): "green" | "amber" | "red" | "blue" => s === "approved" ? "green" : s === "rejected" ? "red" : s === "returned" ? "blue" : "amber";
const stLabel = (s: string) => s === "approved" ? "Approved" : s === "rejected" ? "Declined" : s === "returned" ? "Returned" : "Pending";

function ApprovalsScreen({ data, onApprove, onDecide }: { data: FinanceData; onApprove: (id: string) => Promise<boolean>; onDecide: (id: string, kind: "returned" | "rejected", reason: string) => Promise<boolean> }) {
  const [tab, setTab] = useState("pending_approval");
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const p of data.payments) c[p.status] = (c[p.status] ?? 0) + 1; return c; }, [data.payments]);
  const rows = useMemo(() => data.payments.filter((p) => p.status === tab && (method === "all" || p.method === method) && `${p.student} ${p.description ?? ""} ${p.recordedBy}`.toLowerCase().includes(q.toLowerCase())), [data.payments, tab, method, q]);
  const selected = data.payments.find((p) => p.id === openId) || null;

  return (
    <div className="rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex gap-4 overflow-x-auto border-b border-border-soft">
        {APPROVAL_TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[13px] font-extrabold transition ${tab === k ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-soft hover:text-ink"}`}>{l}{counts[k] ? <span className={`grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] ${tab === k ? "bg-brand-blue text-white" : "bg-paper text-ink-soft"}`}>{counts[k]}</span> : null}</button>)}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3"><span className="text-ink-soft"><Search /></span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payments…" className="min-h-9 flex-1 bg-transparent text-[12px] outline-none" /></div>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="min-h-9 rounded-[10px] border border-border-soft bg-white px-2.5 text-[12px] font-bold text-ink-soft outline-none"><option value="all">All methods</option><option value="cash">Cash</option><option value="transfer">Transfer</option></select>
      </div>

      {rows.length === 0 ? <Empty>No {stLabel(tab).toLowerCase()} payments.</Empty> : <>
        <ul className="grid gap-2 md:hidden">{rows.slice(0, 50).map((p) => (
          <li key={p.id}><button onClick={() => setOpenId(p.id)} className="w-full rounded-xl border border-border-soft p-3 text-left">
            <div className="flex items-center justify-between gap-2"><StudentLink studentId={p.studentId} name={p.student} className="truncate font-bold text-ink" /><Pill tone={stTone(p.status)}>{stLabel(p.status)}</Pill></div>
            <div className="mt-0.5 truncate text-[11px] text-ink-soft">{p.description || "Payment"} · {p.className ?? "-"}</div>
            <div className="mt-1.5 flex items-center justify-between text-[12px]"><span className="font-extrabold text-ink">{naira(p.amount)}</span><span className="capitalize text-ink-soft">{p.method} · {p.recordedBy}</span></div>
          </button></li>
        ))}</ul>
        <div className="-mx-2 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2 font-bold">Student</th><th className="px-2 py-2 font-bold">Fee type</th><th className="px-2 py-2 text-right font-bold">Amount</th><th className="px-2 py-2 font-bold">Method</th><th className="px-2 py-2 font-bold">Recorded by</th><th className="px-2 py-2 font-bold">Date</th><th className="px-2 py-2 font-bold">Status</th><th className="px-2 py-2"></th></tr></thead>
            <tbody>{rows.slice(0, 50).map((p) => (
              <tr key={p.id} onClick={() => setOpenId(p.id)} className={`cursor-pointer border-b border-border-soft last:border-0 ${openId === p.id ? "bg-brand-soft/40" : "hover:bg-paper/60"}`}>
                <td className="px-2 py-2.5"><div className="font-bold text-ink"><StudentLink studentId={p.studentId} name={p.student} /></div><div className="text-[10px] text-ink-soft">{p.className ?? "-"}</div></td>
                <td className="px-2 py-2.5 text-ink-soft">{p.description || "-"}</td>
                <td className="px-2 py-2.5 text-right font-extrabold text-ink">{naira(p.amount)}</td>
                <td className="px-2 py-2.5"><span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold capitalize text-ink-soft">{p.method}</span></td>
                <td className="px-2 py-2.5 text-ink-soft">{p.recordedBy}</td>
                <td className="px-2 py-2.5 text-ink-soft">{p.date}</td>
                <td className="px-2 py-2.5"><Pill tone={stTone(p.status)}>{stLabel(p.status)}</Pill></td>
                <td className="px-2 py-2.5 text-right text-ink-soft">›</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>}

      {selected && <ReviewDrawer p={selected} data={data} onClose={() => setOpenId(null)} onApprove={onApprove} onDecide={onDecide} />}
    </div>
  );
}

function ReviewDrawer({ p, data, onClose, onApprove, onDecide }: { p: Payment; data: FinanceData; onClose: () => void; onApprove: (id: string) => Promise<boolean>; onDecide: (id: string, kind: "returned" | "rejected", reason: string) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "returned" | "rejected">("none");
  const [reason, setReason] = useState("");
  const inv = p.invoiceId ? data.invoices.find((i) => i.id === p.invoiceId) : null;
  const blockedSelf = p.mine && data.requireApproval;
  const canAct = p.status === "pending_approval" && data.canApprove && !blockedSelf;
  const proofSrc = p.proofKey ? `/api/proof/${p.id}` : null;

  async function approve() { setBusy(true); const ok = await onApprove(p.id); setBusy(false); if (ok) onClose(); }
  async function decide() { setBusy(true); const ok = await onDecide(p.id, mode === "returned" ? "returned" : "rejected", reason); setBusy(false); if (ok) onClose(); }

  const Row = ({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) => <div className="flex justify-between gap-3 py-1.5 text-[12px]"><span className="text-ink-soft">{k}</span><span className={`text-right ${strong ? "font-extrabold text-ink" : "font-bold text-ink"}`}>{v}</span></div>;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[min(440px,100%)] flex-col overflow-y-auto bg-white shadow-2xl motion-safe:animate-[fade-up_.2s_ease]">
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4"><h2 className="font-display text-[16px] font-semibold">Review payment</h2><button onClick={onClose} className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-paper"><X /></button></div>
        <div className="grid gap-4 p-5">
          {blockedSelf && <div className="flex items-start gap-2 rounded-[10px] border border-warn-line bg-warn-soft p-3 text-[12px] font-bold text-warn"><span className="mt-0.5"><Info /></span>You can&rsquo;t approve a payment you recorded. Ask another approver.</div>}
          <section><div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Payment summary</div>
            <Row k="Student" v={<>{p.student}{p.className ? <span className="block text-[10px] font-normal text-ink-soft">{p.className}</span> : null}</>} />
            <Row k="Fee type" v={p.description || "General payment"} />
            <Row k="Amount" v={<span className="text-brand-green">{naira(p.amount)}</span>} strong />
            <Row k="Method" v={<span className="capitalize">{p.method}</span>} />
            <Row k="Recorded on" v={p.recordedAt} />
            <Row k="Recorded by" v={p.recordedBy} />
            <Row k="Status" v={<Pill tone={stTone(p.status)}>{stLabel(p.status)}</Pill>} />
          </section>
          {proofSrc && <section><div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Proof of payment</div><a href={proofSrc} target="_blank" rel="noreferrer"><img src={proofSrc} alt="Proof of payment" className="max-h-48 w-full rounded-xl border border-border-soft object-contain" /></a><a href={proofSrc} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-extrabold text-brand-blue hover:underline">View full size ↗</a></section>}
          {inv && <section className="rounded-xl border border-border-soft bg-paper/40 p-3"><div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Invoice balance</div><Row k="Invoice total" v={naira(inv.amount)} /><Row k="Paid (approved)" v={naira(inv.paid)} /><div className="mt-1 flex justify-between border-t border-border-soft pt-2 text-[12px]"><span className="font-extrabold text-ink-soft">Outstanding</span><span className={`font-extrabold ${inv.outstanding > 0 ? "text-warn" : "text-brand-green"}`}>{naira(inv.outstanding)}</span></div></section>}
          <section><div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Audit trail</div>
            <div className="grid gap-2 text-[12px]">
              <div className="flex items-start gap-2"><span className="mt-1 size-2 shrink-0 rounded-full bg-brand-green" /><div><div className="font-bold text-ink">Recorded by {p.recordedBy}</div><div className="text-[10px] text-ink-soft">{p.recordedAt}</div></div></div>
              <div className="flex items-start gap-2"><span className="mt-1 size-2 shrink-0 rounded-full bg-white ring-1 ring-border-soft" /><div className="font-bold text-ink-soft">{p.status === "pending_approval" ? "Awaiting approval" : `${stLabel(p.status)}${p.approver ? ` by ${p.approver}` : ""}`}</div></div>
            </div>
          </section>
        </div>

        {canAct && <div className="mt-auto border-t border-border-soft p-4">
          {mode === "none" ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={approve} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-[10px] bg-brand-green text-[12px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-60"><Check />Approve</button>
              <button onClick={() => setMode("returned")} disabled={busy} className="min-h-10 rounded-[10px] border border-warn-line bg-warn-soft text-[12px] font-extrabold text-warn disabled:opacity-60">Return</button>
              <button onClick={() => setMode("rejected")} disabled={busy} className="min-h-10 rounded-[10px] border border-danger-line bg-danger-soft text-[12px] font-extrabold text-danger disabled:opacity-60">Decline</button>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-[11px] font-extrabold text-ink">{mode === "returned" ? "Why return this for correction?" : "Reason for declining"}</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 250))} rows={2} placeholder="Add a note for the recorder…" className="w-full resize-none rounded-[10px] border border-border-soft bg-paper/60 px-3 py-2 text-[12px] outline-none focus:border-brand-blue focus:bg-white" />
              <div className="flex gap-2"><button onClick={decide} disabled={busy} className={`min-h-10 flex-1 rounded-[10px] text-[12px] font-extrabold text-white disabled:opacity-60 ${mode === "returned" ? "bg-warn" : "bg-danger"}`}>{busy ? "Saving…" : mode === "returned" ? "Return payment" : "Decline payment"}</button><button onClick={() => { setMode("none"); setReason(""); }} disabled={busy} className="min-h-10 rounded-[10px] border border-border-soft px-4 text-[12px] font-extrabold text-ink-soft">Cancel</button></div>
            </div>
          )}
        </div>}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------- Issue fees
type ItemDraft = { name: string; amount: string; mandatory: boolean };
const LEVELS = ["Primary", "JSS", "SSS"];
const classLevel = (c: string, lv: string) => lv === "Primary" ? /primary|pry|basic/i.test(c) : lv === "JSS" ? /jss|j\.?s\.?s/i.test(c) : /sss|s\.?s\.?s/i.test(c);

function IssueFeesCard({ data, onDone, onErr }: { data: FinanceData; onDone: (n: number) => void; onErr: (e: string) => void }) {
  const { terms: termOptions, current: currentTerm } = useAcademicTerms();
  const [tab, setTab] = useState<"issue" | "structures">("issue");
  const [billName, setBillName] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { if (currentTerm) setTerm((t) => t || currentTerm); }, [currentTerm]);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ name: "Tuition", amount: "", mandatory: true }]);
  const [mode, setMode] = useState<"all" | "selected" | "level">("all");
  const [selClasses, setSelClasses] = useState<string[]>([]);
  const [selLevels, setSelLevels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const allClassNames = useClassNames();

  const countMap = useMemo(() => new Map(data.classCounts.map((c) => [c.className, c.count])), [data.classCounts]);
  // Resolve the target classes from the chosen mode.
  const classes = useMemo(() => mode === "all" ? [] : mode === "selected" ? selClasses : allClassNames.filter((c) => selLevels.some((lv) => classLevel(c, lv))), [mode, selClasses, selLevels, allClassNames]);
  const invoiced = (mode === "all") ? data.students.length : classes.reduce((n, c) => n + (countMap.get(c) ?? 0), 0);
  const perStudent = items.reduce((n, it) => n + (Number(it.amount) || 0), 0);
  const mandatoryPer = items.filter((it) => it.mandatory).reduce((n, it) => n + (Number(it.amount) || 0), 0);
  const remaining = allClassNames.filter((c) => !selClasses.includes(c));
  const setItem = (i: number, patch: Partial<ItemDraft>) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const validItems = items.filter((it) => it.name.trim() && Number(it.amount) > 0);

  function useTemplate(f: typeof data.fees[number]) {
    if (f.items.length) setItems(f.items.map((it) => ({ name: it.name, amount: String(it.amount), mandatory: it.mandatory })));
    setBillName(f.name);
    if (f.termLabel) setTerm(f.termLabel);
    setTab("issue");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = billName.trim() || term;
    const payload = items.map((it) => ({ name: it.name.trim(), amount: Number(it.amount), mandatory: it.mandatory })).filter((it) => it.name && it.amount > 0);
    if (payload.length === 0) { onErr("Add at least one fee item with an amount."); return; }
    setBusy(true);
    const r = await createFeeStructure({ name, termLabel: term, dueDate: dueDate || undefined, classes, items: payload });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setBillName(""); setItems([{ name: "Tuition", amount: "", mandatory: true }]); setSelClasses([]); setSelLevels([]); setMode("all"); setDueDate("");
    onDone(r.issued);
  }

  const Reusable = (
    <section className="rounded-2xl border border-border-soft bg-white p-5">
      <h3 className="mb-3 font-display text-[15px] font-semibold">Reusable fee structures</h3>
      {data.fees.length === 0 ? <p className="text-[12px] text-ink-soft">Bills you issue are saved here to reuse.</p> : <ul className="grid gap-2">{data.fees.slice(0, 12).map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-border-soft p-3">
          <div className="min-w-0"><div className="truncate font-bold text-ink">{f.name}</div><div className="text-[11px] text-ink-soft">{f.termLabel ?? "—"} · {f.items.length} item{f.items.length === 1 ? "" : "s"} · {naira(f.amount)}</div></div>
          <button onClick={() => useTemplate(f)} className="shrink-0 rounded-[8px] border border-border-soft bg-white px-3 py-1.5 text-[11px] font-extrabold text-brand-blue transition hover:bg-brand-soft">Use</button>
        </li>
      ))}</ul>}
    </section>
  );

  return (
    <div className="grid gap-[18px]">
      <div className="flex gap-4 border-b border-border-soft">
        {([["issue", "Issue bills"], ["structures", "Fee structures"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-2 text-[13px] font-extrabold transition ${tab === k ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-soft hover:text-ink"}`}>{l}</button>)}
      </div>

      {tab === "structures" ? Reusable : (
        <div className="grid gap-[18px] xl:grid-cols-[1.5fr_1fr]">
          {/* Builder */}
          <form onSubmit={submit} className="rounded-2xl border border-border-soft bg-white p-5">
            <h2 className="mb-4 font-display text-[16px] font-semibold">Create a new bill</h2>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Term"><select value={term} onChange={(e) => setTerm(e.target.value)} className={selectCls}>{[...new Set([term, ...termOptions].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Bill name"><input value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="e.g. Term 2 - School Fees" className={inputCls} /></Field>
              <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-extrabold text-ink">Apply bill to</span>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {([["all", "🏫 All classes"], ["selected", "Selected classes"], ["level", "By level"]] as const).map(([m, l]) => <button key={m} type="button" onClick={() => setMode(m)} className={`min-h-9 rounded-[10px] border text-[12px] font-extrabold transition ${mode === m ? "border-brand-blue bg-brand-soft text-brand-blue" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue"}`}>{l}</button>)}
              </div>
              {mode === "level" && <div className="mt-2 flex flex-wrap gap-2">{LEVELS.map((lv) => <button key={lv} type="button" onClick={() => setSelLevels((v) => v.includes(lv) ? v.filter((x) => x !== lv) : [...v, lv])} className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${selLevels.includes(lv) ? "bg-brand-blue text-white" : "bg-paper text-ink-soft hover:text-brand-blue"}`}>{lv}</button>)}</div>}
              {mode === "selected" && <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border-soft bg-paper/50 p-2">{selClasses.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-blue">{c}<button type="button" onClick={() => setSelClasses((v) => v.filter((x) => x !== c))} className="text-brand-blue/70 hover:text-brand-blue">✕</button></span>)}{remaining.length > 0 && <select value="" onChange={(e) => { if (e.target.value) setSelClasses((v) => [...v, e.target.value]); }} className="ml-auto rounded-md border border-border-soft bg-white px-2 py-1 text-[11px] font-bold text-ink-soft outline-none"><option value="">+ Add class</option>{remaining.map((c) => <option key={c} value={c}>{c}</option>)}</select>}</div>}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[11px] font-extrabold text-ink">Fee items</span><span className="text-[10px] text-ink-soft">Mark each mandatory or optional</span></div>
              <datalist id="fee-item-names">{FEE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
              <div className="grid gap-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-[10px] border border-border-soft bg-paper/40 p-2">
                    <input list="fee-item-names" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Item (e.g. Excursion)" className="min-h-9 min-w-0 flex-1 rounded-[8px] border border-border-soft bg-white px-2.5 text-[12px] outline-none focus:border-brand-blue" />
                    <input value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} type="number" min="0" step="0.01" placeholder="₦" className="min-h-9 w-24 rounded-[8px] border border-border-soft bg-white px-2.5 text-[12px] outline-none focus:border-brand-blue" />
                    <button type="button" onClick={() => setItem(i, { mandatory: !it.mandatory })} className={`min-h-9 shrink-0 rounded-full px-2.5 text-[10px] font-extrabold transition ${it.mandatory ? "bg-brand-blue text-white" : "bg-warn-soft text-warn"}`}>{it.mandatory ? "Mandatory" : "Optional"}</button>
                    <button type="button" onClick={() => setItems((a) => a.length > 1 ? a.filter((_, idx) => idx !== i) : a)} disabled={items.length === 1} className="grid size-9 shrink-0 place-items-center rounded-[8px] text-ink-soft hover:bg-paper disabled:opacity-30" title="Remove">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems((a) => [...a, { name: "", amount: "", mandatory: true }])} className="mt-2 text-[12px] font-extrabold text-brand-blue hover:underline">+ Add fee item</button>
            </div>
          </form>

          {/* Preview & summary + reusable */}
          <div className="grid content-start gap-[18px]">
            <section className="rounded-2xl border border-border-soft bg-white p-5">
              <h3 className="mb-3 font-display text-[15px] font-semibold">Bill preview &amp; summary</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Classes" value={mode === "all" ? "All" : String(classes.length)} />
                <Stat label="Students affected" value={invoiced.toLocaleString()} />
                <Stat label="Amount / student" value={naira(perStudent)} color="#2159e8" />
                <Stat label="Total expected" value={compactNaira(perStudent * invoiced)} color="#178a4c" />
              </div>
              {validItems.length > 0 && <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Fee breakdown (per student)</div>
                <ul className="grid gap-1">{validItems.map((it, i) => <li key={i} className="flex items-center justify-between gap-2 text-[12px]"><span className="text-ink-soft">{it.name}{!it.mandatory && <span className="ml-1.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[9px] font-extrabold text-warn">Optional</span>}</span><span className="font-bold text-ink">{naira(Number(it.amount))}</span></li>)}</ul>
                <div className="mt-2 flex items-center justify-between border-t border-border-soft pt-2 text-[13px] font-extrabold"><span>Total (per student)</span><span className="text-brand-green">{naira(perStudent)}</span></div>
              </div>}
              <button onClick={submit} disabled={busy || invoiced === 0 || validItems.length === 0} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60"><Send />{busy ? "Issuing…" : "Create and issue bills"}</button>
              {invoiced === 0 && <p className="mt-1 text-center text-[11px] text-ink-soft">No students in the selected scope yet.</p>}
              <p className="mt-2 text-center text-[10px] text-ink-soft">Bills are created for the selected students and visible to parents.</p>
            </section>
            {Reusable}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- Invoices & receipts
// Filterable, selectable list with print/download for both invoices and receipts.
function InvoicesReceiptsCard({ data }: { data: FinanceData }) {
  const [tab, setTab] = useState<"invoices" | "receipts" | "credit notes">("invoices");
  return (
    <section className="grid gap-[18px]">
      <div className="flex gap-4 border-b border-border-soft">
        {(["invoices", "receipts", "credit notes"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2 text-[13px] font-extrabold capitalize transition ${tab === t ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-soft hover:text-ink"}`}>{t}</button>)}
      </div>
      {tab === "invoices" ? <InvoiceReportTab data={data} /> : tab === "receipts" ? <ReceiptReportTab data={data} /> : <CreditNotesTab data={data} />}
    </section>
  );
}

// Credit notes = overpayment credits on a student's invoices (refunds are processed in Overpayments & refunds).
function CreditNotesTab({ data }: { data: FinanceData }) {
  const credits = useMemo(() => {
    const m = new Map<string, { student: string; admissionNo: string; credit: number }>();
    for (const i of data.invoices) { const c = Math.max(0, i.paid - i.amount); if (c > 0) { const e = m.get(i.studentId) ?? { student: i.student, admissionNo: i.admissionNo, credit: 0 }; e.credit += c; m.set(i.studentId, e); } }
    return [...m.values()].sort((a, b) => b.credit - a.credit);
  }, [data.invoices]);
  const total = credits.reduce((n, c) => n + c.credit, 0);
  return (
    <div className="rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-[15px] font-semibold">Credit notes</h3><div className="text-right"><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Total credit</div><div className="font-display text-[16px] font-bold text-brand-blue">{naira(total)}</div></div></div>
      {credits.length === 0 ? <Empty>No overpayment credits. Credits appear when a student pays more than an invoice&rsquo;s total.</Empty> : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12px]">
            <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2 font-bold">Student</th><th className="px-2 py-2 font-bold">Admission no.</th><th className="px-2 py-2 text-right font-bold">Credit balance</th></tr></thead>
            <tbody>{credits.map((c) => (
              <tr key={c.admissionNo} className="border-b border-border-soft last:border-0"><td className="px-2 py-2.5 font-bold text-ink">{c.student}</td><td className="px-2 py-2.5"><code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{c.admissionNo}</code></td><td className="px-2 py-2.5 text-right font-extrabold text-brand-blue">{naira(c.credit)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-soft">Process refunds or carry credit forward in <strong>Overpayments &amp; refunds</strong>.</p>
    </div>
  );
}

// Small selection helper shared by both tabs.
function useSelection() {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAll = (ids: string[], on: boolean) => setSel(on ? new Set(ids) : new Set());
  const clear = () => setSel(new Set());
  return { sel, toggle, setAll, clear };
}

function ExportBar({ count, allSelected, onToggleAll, selCount, onSelected, onAll, allLabel, note }: { count: number; allSelected: boolean; onToggleAll: () => void; selCount: number; onSelected: () => void; onAll: () => void; allLabel: string; note: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper/60 px-2.5 py-1.5">
      <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-ink-soft"><input type="checkbox" checked={allSelected} onChange={onToggleAll} className="size-3.5 accent-brand-blue" />{selCount > 0 ? `${selCount} selected` : "Select all on this page"}</label>
      <div className="flex items-center gap-2">
        <span className="hidden text-[11px] text-ink-soft sm:inline">{note}</span>
        <button onClick={onSelected} disabled={selCount === 0} className="inline-flex items-center gap-1.5 rounded-[8px] border border-border-soft bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-brand-blue transition hover:bg-brand-soft disabled:opacity-40"><Download />Selected</button>
        <button onClick={onAll} disabled={count === 0} className="inline-flex items-center gap-1.5 rounded-[8px] bg-brand-blue px-2.5 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-40"><Download />{allLabel}</button>
      </div>
    </div>
  );
}

function InvoiceReportTab({ data }: { data: FinanceData }) {
  const classes = useMemo(() => data.classCounts.map((c) => c.className), [data.classCounts]);
  const terms = useMemo(() => [...new Set(data.fees.map((f) => f.termLabel).filter(Boolean) as string[])], [data.fees]);
  const [className, setClassName] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<InvoiceReportRow[] | null>(null);
  const [matched, setMatched] = useState(0);
  const [cap, setCap] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { sel, toggle, setAll, clear } = useSelection();

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    const r = await getInvoiceReport({ className: className || undefined, termLabel: term || undefined, status: status || undefined });
    setBusy(false);
    if ("error" in r) { setErr(r.error); setRows([]); return; }
    setRows(r.rows); setMatched(r.matched); setCap(r.cap); clear();
  }, [className, term, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => (rows ?? []).reduce((a, r) => ({ total: a.total + r.total, paid: a.paid + r.paid, outstanding: a.outstanding + r.outstanding }), { total: 0, paid: 0, outstanding: 0 }), [rows]);
  const shown = rows ?? [];
  const allSelected = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const printSelected = () => { if (sel.size) window.open(`/invoice/print?ids=${[...sel].join(",")}`, "_blank"); };
  const printAll = () => { const p = new URLSearchParams({ report: "1" }); if (className) p.set("class", className); if (term) p.set("term", term); if (status) p.set("status", status); window.open(`/invoice/print?${p.toString()}`, "_blank"); };
  const stTone = (s: string): "green" | "amber" | "red" => (s === "paid" ? "green" : s === "partially_paid" ? "amber" : "red");
  const stLabel = (s: string) => (s === "paid" ? "Paid" : s === "partially_paid" ? "Partially paid" : "Unpaid");
  const truncated = matched > cap;

  return (
    <div className="grid gap-[18px]">
      <div className="rounded-2xl border border-border-soft bg-white p-5">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Class"><select value={className} onChange={(e) => setClassName(e.target.value)} className={selectCls}><option value="">All classes</option>{classes.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Term"><select value={term} onChange={(e) => setTerm(e.target.value)} className={selectCls}><option value="">All terms</option>{terms.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}><option value="">Any status</option><option value="outstanding">Unpaid</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option></select></Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Bills" value={busy ? "…" : String(matched)} />
          <Stat label="Invoiced" value={compactNaira(totals.total)} color="#178a4c" />
          <Stat label="Collected" value={compactNaira(totals.paid)} color="#2159e8" />
          <Stat label="Outstanding" value={compactNaira(totals.outstanding)} color="#b9540f" />
        </div>
        {err && <div className="mt-3 rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[12px] font-bold text-danger">{err}</div>}
      </div>

      <div className="rounded-2xl border border-border-soft bg-white p-5">
        {shown.length > 0 && <div className="mb-3"><ExportBar count={matched} allSelected={allSelected} onToggleAll={() => setAll(shown.map((r) => r.id), !allSelected)} selCount={sel.size} onSelected={printSelected} onAll={printAll} allLabel={`Download all (${Math.min(matched, cap)})`} note={truncated ? `First ${cap} of ${matched}` : "Print/save as one PDF"} /></div>}
        {rows === null ? <LoadingRows /> : rows.length === 0 ? <Empty>No invoices match this filter.</Empty> : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="grid gap-2 md:hidden">{shown.slice(0, 50).map((r) => (
              <li key={r.id} onClick={() => setOpenId(r.id)} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${sel.has(r.id) ? "border-brand-blue bg-brand-soft/30" : "border-border-soft"}`}>
                <input type="checkbox" checked={sel.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} className="mt-0.5 size-3.5 shrink-0 accent-brand-blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><StudentLink studentId={r.studentId} name={r.student} className="truncate font-bold text-ink" /><Pill tone={stTone(r.status)}>{stLabel(r.status)}</Pill></div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-soft">{r.className ?? "-"}{r.billName ? ` · ${r.billName}` : ""}{r.termLabel ? ` · ${r.termLabel}` : ""}</div>
                  <div className="mt-1.5 flex items-center justify-between text-[12px]"><span className="text-ink-soft">Total <b className="text-ink">{naira(r.total)}</b></span><span className="text-ink-soft">Due <b className="text-warn">{naira(r.outstanding)}</b></span></div>
                </div>
                <a href={`/invoice/${r.id}`} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" title="Open invoice" className="grid size-8 shrink-0 place-items-center rounded-md border border-border-soft text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Download /></a>
              </li>
            ))}</ul>
            {/* Desktop: table */}
            <div className="-mx-2 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-left text-[12px]">
                <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2"></th><th className="px-2 py-2 font-bold">Student</th><th className="px-2 py-2 font-bold">Class</th><th className="px-2 py-2 font-bold">Bill</th><th className="px-2 py-2 text-right font-bold">Total</th><th className="px-2 py-2 text-right font-bold">Outstanding</th><th className="px-2 py-2 font-bold">Status</th><th className="px-2 py-2 text-right font-bold">Open</th></tr></thead>
                <tbody>{shown.slice(0, 50).map((r) => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer border-b border-border-soft last:border-0 ${openId === r.id ? "bg-brand-soft/40" : sel.has(r.id) ? "bg-brand-soft/30" : "hover:bg-paper/60"}`}>
                    <td className="px-2 py-2.5"><input type="checkbox" checked={sel.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} className="size-3.5 accent-brand-blue" /></td>
                    <td className="px-2 py-2.5 font-bold text-ink"><StudentLink studentId={r.studentId} name={r.student} /></td>
                    <td className="px-2 py-2.5 text-ink-soft">{r.className ?? "-"}</td>
                    <td className="px-2 py-2.5 text-ink-soft">{r.billName ?? "-"}{r.termLabel ? ` · ${r.termLabel}` : ""}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-ink">{naira(r.total)}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-warn">{naira(r.outstanding)}</td>
                    <td className="px-2 py-2.5"><Pill tone={stTone(r.status)}>{stLabel(r.status)}</Pill></td>
                    <td className="px-2 py-2.5"><div className="flex justify-end"><a href={`/invoice/${r.id}`} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" title="Open invoice" className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Download /></a></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {shown.length > 50 && <p className="mt-3 text-center text-[11px] text-ink-soft">Preview shows 50 of {shown.length}. Use Download all for the full set.</p>}
          </>
        )}
      </div>
      {openId && <InvoicePreviewDrawer r={shown.find((x) => x.id === openId)!} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function InvoicePreviewDrawer({ r, onClose }: { r: InvoiceReportRow; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stTone = (s: string): "green" | "amber" | "red" => (s === "paid" ? "green" : s === "partially_paid" ? "amber" : "red");
  const stLabel = (s: string) => (s === "paid" ? "Paid" : s === "partially_paid" ? "Partially paid" : "Unpaid");
  async function remind() { setBusy(true); setErr(null); setMsg(null); const res = await sendInvoiceReminder(r.id); setBusy(false); if ("error" in res) setErr(res.error); else setMsg("Reminder emailed to the guardian."); }
  async function share() { try { const url = `${window.location.origin}/invoice/${r.id}`; if (navigator.share) await navigator.share({ title: `Invoice ${r.no}`, url }); else { await navigator.clipboard.writeText(url); setMsg("Invoice link copied."); } } catch { /* dismissed */ } }
  const Row = ({ k, v, c }: { k: string; v: string; c?: string }) => <div className="flex justify-between gap-3 py-1.5 text-[12px]"><span className="text-ink-soft">{k}</span><span className={`text-right font-bold ${c ?? "text-ink"}`}>{v}</span></div>;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[min(440px,100%)] flex-col overflow-y-auto bg-white shadow-2xl motion-safe:animate-[fade-up_.2s_ease]">
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4"><div className="flex items-center gap-2"><span className="font-display text-[16px] font-semibold">{r.no}</span><Pill tone={stTone(r.status)}>{stLabel(r.status)}</Pill></div><button onClick={onClose} className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-paper"><X /></button></div>
        <div className="grid gap-3 p-5">
          <section><div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Invoice</div>
            <Row k="Student" v={r.student} />
            {r.className && <Row k="Class" v={r.className} />}
            {(r.billName || r.termLabel) && <Row k="Bill" v={`${r.billName ?? ""}${r.billName && r.termLabel ? " · " : ""}${r.termLabel ?? ""}`} />}
            <Row k="Total" v={naira(r.total)} />
            <Row k="Paid" v={naira(r.paid)} c="text-brand-green" />
            <Row k="Outstanding" v={naira(r.outstanding)} c={r.outstanding > 0 ? "text-warn" : "text-brand-green"} />
          </section>
          {msg && <div className="rounded-[10px] border border-brand-green/30 bg-brand-green/10 px-3 py-2 text-[12px] font-bold text-brand-green">{msg}</div>}
          {err && <div className="rounded-[10px] border border-danger-line bg-danger-soft px-3 py-2 text-[12px] font-bold text-danger">{err}</div>}
        </div>
        <div className="mt-auto grid gap-2 border-t border-border-soft p-4">
          <a href={`/invoice/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-blue text-[13px] font-extrabold text-white transition hover:bg-brand-dark"><Download />Download / View PDF</a>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={share} className="min-h-10 rounded-[10px] border border-border-soft text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft">Share link</button>
            <button onClick={remind} disabled={busy || r.outstanding <= 0} className="min-h-10 rounded-[10px] border border-border-soft text-[12px] font-extrabold text-ink transition hover:border-brand-blue disabled:opacity-50">{busy ? "Sending…" : "Send reminder"}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReceiptReportTab({ data }: { data: FinanceData }) {
  const classes = useMemo(() => data.classCounts.map((c) => c.className), [data.classCounts]);
  const terms = useMemo(() => [...new Set(data.fees.map((f) => f.termLabel).filter(Boolean) as string[])], [data.fees]);
  const [className, setClassName] = useState("");
  const [term, setTerm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<ReceiptReportRow[] | null>(null);
  const [matched, setMatched] = useState(0);
  const [cap, setCap] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { sel, toggle, setAll, clear } = useSelection();

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    const r = await getReceiptReport({ className: className || undefined, termLabel: term || undefined, from: from || undefined, to: to || undefined });
    setBusy(false);
    if ("error" in r) { setErr(r.error); setRows([]); return; }
    setRows(r.rows); setMatched(r.matched); setCap(r.cap); clear();
  }, [className, term, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => (rows ?? []).reduce((a, r) => a + r.amount, 0), [rows]);
  const shown = rows ?? [];
  const allSelected = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const printSelected = () => { if (sel.size) window.open(`/receipt/print?ids=${[...sel].join(",")}`, "_blank"); };
  const printAll = () => { const p = new URLSearchParams({ report: "1" }); if (className) p.set("class", className); if (term) p.set("term", term); if (from) p.set("from", from); if (to) p.set("to", to); window.open(`/receipt/print?${p.toString()}`, "_blank"); };
  const truncated = matched > cap;

  return (
    <div className="grid gap-[18px]">
      <div className="rounded-2xl border border-border-soft bg-white p-5">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Class"><select value={className} onChange={(e) => setClassName(e.target.value)} className={selectCls}><option value="">All classes</option>{classes.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Term"><select value={term} onChange={(e) => setTerm(e.target.value)} className={selectCls}><option value="">All terms</option>{terms.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="From"><input type="date" value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
          <Field label="To"><input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Stat label="Receipts" value={busy ? "…" : String(matched)} />
          <Stat label="Total collected" value={compactNaira(total)} color="#178a4c" />
        </div>
        {err && <div className="mt-3 rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[12px] font-bold text-danger">{err}</div>}
      </div>

      <div className="rounded-2xl border border-border-soft bg-white p-5">
        {shown.length > 0 && <div className="mb-3"><ExportBar count={matched} allSelected={allSelected} onToggleAll={() => setAll(shown.map((r) => r.id), !allSelected)} selCount={sel.size} onSelected={printSelected} onAll={printAll} allLabel={`Download all (${Math.min(matched, cap)})`} note={truncated ? `First ${cap} of ${matched}` : "Print/save as one PDF"} /></div>}
        {rows === null ? <LoadingRows /> : rows.length === 0 ? <Empty>No receipts match this filter.</Empty> : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="grid gap-2 md:hidden">{shown.slice(0, 50).map((r) => (
              <li key={r.id} className={`flex items-start gap-2.5 rounded-xl border p-3 ${sel.has(r.id) ? "border-brand-blue bg-brand-soft/30" : "border-border-soft"}`}>
                <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="mt-0.5 size-3.5 shrink-0 accent-brand-blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-bold text-ink">{r.student}</span><span className="shrink-0 font-extrabold text-ink">{naira(r.amount)}</span></div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft"><code className="font-extrabold text-ink-soft">{r.no}</code><span>·</span><span className="capitalize">{r.method}</span></div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-soft">{r.className ?? "-"} · {r.date}</div>
                </div>
                <a href={r.token ? `/r/${r.token}` : `/receipt/${r.id}`} target="_blank" rel="noreferrer" title="Open receipt" className="grid size-8 shrink-0 place-items-center rounded-md border border-border-soft text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Download /></a>
              </li>
            ))}</ul>
            {/* Desktop: table */}
            <div className="-mx-2 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2"></th><th className="px-2 py-2 font-bold">Receipt</th><th className="px-2 py-2 font-bold">Student</th><th className="px-2 py-2 font-bold">Class</th><th className="px-2 py-2 font-bold">Method</th><th className="px-2 py-2 text-right font-bold">Amount</th><th className="px-2 py-2 font-bold">Date</th><th className="px-2 py-2 text-right font-bold">Open</th></tr></thead>
                <tbody>{shown.slice(0, 50).map((r) => (
                  <tr key={r.id} className={`border-b border-border-soft last:border-0 ${sel.has(r.id) ? "bg-brand-soft/30" : "hover:bg-paper/60"}`}>
                    <td className="px-2 py-2.5"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="size-3.5 accent-brand-blue" /></td>
                    <td className="px-2 py-2.5"><code className="text-[11px] font-extrabold text-ink">{r.no}</code></td>
                    <td className="px-2 py-2.5 font-bold text-ink"><StudentLink studentId={r.studentId} name={r.student} /></td>
                    <td className="px-2 py-2.5 text-ink-soft">{r.className ?? "-"}</td>
                    <td className="px-2 py-2.5 capitalize text-ink-soft">{r.method}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-ink">{naira(r.amount)}</td>
                    <td className="px-2 py-2.5 text-ink-soft">{r.date}</td>
                    <td className="px-2 py-2.5"><div className="flex justify-end"><a href={r.token ? `/r/${r.token}` : `/receipt/${r.id}`} target="_blank" rel="noreferrer" title="Open receipt" className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Download /></a></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {shown.length > 50 && <p className="mt-3 text-center text-[11px] text-ink-soft">Preview shows 50 of {shown.length}. Use Download all for the full set.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="rounded-xl border border-border-soft bg-paper/50 px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</div><div className="mt-0.5 font-display text-[16px] font-bold" style={color ? { color } : undefined}>{value}</div></div>;
}

// ---------------------------------------------------------------------------- Overpayments & refunds
function OverpaymentsScreen({ onErr, onOk }: { onErr: (e: string) => void; onOk: (m: string) => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof getOverpayments>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refundFor, setRefundFor] = useState<OverpaymentRow | null>(null);
  const load = useCallback(async () => { const r = await getOverpayments(); setD(r); }, []);
  useEffect(() => { load(); }, [load]);

  if (!d) return <LoadingPanel stats={3} />;
  if ("error" in d) return <LoadError message={d.error} onRetry={load} />;
  const { credits, requests, totalCredit, pending, canManage, canApprove, requireApproval } = d;

  async function carry(s: OverpaymentRow) {
    if (!confirm(`Carry ${naira(s.credit)} credit for ${s.student} forward to next term?`)) return;
    setBusy(s.studentId); const r = await carryForwardCredit(s.studentId); setBusy(null);
    if ("error" in r) onErr(r.error); else { onOk(`Credit for ${s.student} carried forward.`); load(); }
  }
  async function decide(id: string, approve: boolean) {
    setBusy(id); const r = await decideRefund(id, approve); setBusy(null);
    if ("error" in r) onErr(r.error); else { onOk(approve ? "Refund approved." : "Refund rejected."); load(); }
  }

  const stTone = (s: string): "green" | "amber" | "red" => s === "approved" ? "green" : s === "rejected" ? "red" : "amber";

  return (
    <div className="grid gap-[18px]">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat label="Total credit" value={compactNaira(totalCredit)} color="#0f8a8a" />
        <Stat label="Students in credit" value={String(credits.length)} color="#2159e8" />
        <Stat label="Pending refunds" value={String(pending)} color="#b9540f" />
      </div>

      {/* Credit balances */}
      <div className="rounded-2xl border border-border-soft bg-white p-5">
        <h3 className="font-display text-[15px] font-semibold">Overpayment credits</h3>
        <p className="mb-3 mt-0.5 text-[11px] text-ink-soft">A credit automatically offsets the student&rsquo;s next-term bill (carry forward), or you can refund it. Refunds need a second approver.</p>
        {credits.length === 0 ? <Empty>No overpayments. A credit appears when a student pays more than they were billed.</Empty> : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2 font-bold">Student</th><th className="px-2 py-2 font-bold">Class</th><th className="px-2 py-2 text-right font-bold">Credit</th><th className="px-2 py-2 text-right font-bold">Action</th></tr></thead>
              <tbody>{credits.map((s) => (
                <tr key={s.studentId} className="border-b border-border-soft last:border-0 hover:bg-paper/60">
                  <td className="px-2 py-2.5"><div className="font-bold text-ink"><StudentLink studentId={s.studentId} name={s.student} /></div><div className="text-[10px] text-ink-soft">{s.admissionNo}</div></td>
                  <td className="px-2 py-2.5 text-ink-soft">{s.className ?? "-"}</td>
                  <td className="px-2 py-2.5 text-right font-extrabold text-accent-teal">{naira(s.credit)}</td>
                  <td className="px-2 py-2.5"><div className="flex justify-end gap-1.5">
                    {canManage ? <><button onClick={() => carry(s)} disabled={busy === s.studentId} className="rounded-[8px] border border-border-soft bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue disabled:opacity-50">Carry forward</button><button onClick={() => setRefundFor(s)} disabled={busy === s.studentId} className="rounded-[8px] bg-brand-blue px-2.5 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50">Refund</button></> : <span className="text-ink-soft/60">—</span>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund requests */}
      <div className="rounded-2xl border border-border-soft bg-white p-5">
        <h3 className="mb-3 font-display text-[15px] font-semibold">Refund requests</h3>
        {requests.length === 0 ? <Empty>No refund requests yet.</Empty> : (
          <ul className="grid gap-2">{requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft p-3">
              <div className="min-w-0"><div className="flex items-center gap-2"><StudentLink studentId={r.studentId} name={r.student} className="truncate font-bold text-ink" /><Pill tone={stTone(r.status)}>{r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Pending"}</Pill></div><div className="text-[11px] text-ink-soft">{naira(r.amount)}{r.reason ? ` · ${r.reason}` : ""} · by {r.requestedBy ?? "-"} · {r.date}</div></div>
              {r.status === "pending" && canApprove && <div className="flex shrink-0 gap-1.5">
                <button onClick={() => decide(r.id, true)} disabled={busy === r.id || (r.mine && requireApproval)} title={r.mine && requireApproval ? "Maker-checker: a different approver must approve" : "Approve"} className="rounded-[8px] bg-brand-green px-2.5 py-1.5 text-[11px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-40">Approve</button>
                <button onClick={() => decide(r.id, false)} disabled={busy === r.id} className="rounded-[8px] border border-danger-line bg-danger-soft px-2.5 py-1.5 text-[11px] font-extrabold text-danger disabled:opacity-40">Reject</button>
              </div>}
            </li>
          ))}</ul>
        )}
      </div>

      {refundFor && <RefundDrawer s={refundFor} onClose={() => setRefundFor(null)} onErr={onErr} onDone={(approved) => { setRefundFor(null); onOk(approved ? "Refund approved." : "Refund request submitted for approval."); load(); }} />}
    </div>
  );
}

function RefundDrawer({ s, onClose, onErr, onDone }: { s: OverpaymentRow; onClose: () => void; onErr: (e: string) => void; onDone: (approved: boolean) => void }) {
  const [amount, setAmount] = useState(String(Math.round(s.credit)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await requestRefund({ studentId: s.studentId, amount: Number(amount), reason });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    onDone(r.approved);
  }
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[min(420px,100%)] flex-col bg-white shadow-2xl motion-safe:animate-[fade-up_.2s_ease]">
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4"><h2 className="font-display text-[16px] font-semibold">Refund {s.student}</h2><button onClick={onClose} className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-paper"><X /></button></div>
        <form onSubmit={submit} className="grid gap-3 p-5">
          <div className="rounded-[10px] bg-paper/60 p-3 text-[12px]"><div className="flex justify-between"><span className="text-ink-soft">Available credit</span><span className="font-extrabold text-accent-teal">{naira(s.credit)}</span></div></div>
          <Field label="Refund amount (₦)"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" max={s.credit} step="0.01" required className={inputCls} /></Field>
          <Field label={<>Reason <span className="font-bold text-ink-soft">(optional)</span></>}><textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 250))} rows={3} placeholder="e.g. duplicate payment" className="w-full resize-none rounded-[10px] border border-border-soft bg-paper/60 px-3 py-2 text-[13px] outline-none focus:border-brand-blue focus:bg-white" /></Field>
          <p className="text-[11px] text-ink-soft">The refund is submitted for approval — a different staff member must approve it (maker-checker).</p>
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60"><Send />{busy ? "Submitting…" : "Submit refund request"}</button>
        </form>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------- shared bits
const inputCls = "min-h-10 w-full rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none transition focus:border-brand-blue focus:bg-white";
const selectCls = inputCls + " disabled:opacity-60";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">{label}</span>{children}</label>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">{children}</div>;
}
function Avatar({ name }: { name: string }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundColor: AV[name.length % AV.length] }}>{initials(name)}</span>;
}
function Pill({ tone, children }: { tone: "green" | "red" | "amber" | "blue"; children: React.ReactNode }) {
  const c = { green: "bg-brand-green/10 text-brand-green", red: "bg-danger-soft text-danger", amber: "bg-warn-soft text-warn", blue: "bg-brand-soft text-brand-blue" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${c}`}>{children}</span>;
}
function PageBtn({ children, active, disabled, onClick }: { children: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className={`grid size-7 place-items-center rounded-md border text-[11px] font-bold transition disabled:opacity-40 ${active ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft text-ink-soft hover:bg-paper"}`}>{children}</button>;
}

function StudentPicker({ students, value, onChange }: { students: Student[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sel = students.find((s) => s.id === value);
  const filtered = students.filter((s) => `${s.name} ${s.admissionNo} ${s.className ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3 focus-within:border-brand-blue focus-within:bg-white">
        <span className="text-ink-soft"><Search /></span>
        <input value={open ? q : sel ? `${sel.name} (${sel.admissionNo})` : ""} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => { setQ(""); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Search student by name or admission no." className="min-h-10 flex-1 bg-transparent text-[13px] text-ink outline-none" />
        <span className="text-ink-soft">▾</span>
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border-soft bg-white py-1 shadow-lg">
          {filtered.length === 0 ? <li className="px-3 py-2 text-[12px] text-ink-soft">No match.</li> : filtered.map((s) => (
            <li key={s.id}><button type="button" onMouseDown={() => { onChange(s.id); setOpen(false); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-paper"><span className="font-bold text-ink">{s.name}</span><span className="text-[11px] text-ink-soft">{s.admissionNo}{s.className ? ` · ${s.className}` : ""}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- icons (18px inline)
const svg = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;
const Wallet = () => svg(<><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2z" /><path d="M3 8v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2" /><circle cx="16" cy="13" r="1.2" fill="currentColor" /></>);
const Chart = () => svg(<><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" /></>);
const Receipt = () => svg(<><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1Z" /><path d="M9 8h6M9 12h6" /></>);
const Doc = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>);
const Card2 = () => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>);
const Shield = () => svg(<><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></>);
const Bank = () => svg(<><path d="M3 10l9-5 9 5" /><path d="M5 10v8M19 10v8M9 10v8M15 10v8M3 21h18" /></>);
const Upload = () => svg(<><path d="M12 16V5M8 9l4-4 4 4" /><path d="M5 19h14" /></>);
const Send = () => svg(<><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></>);
const Users = () => svg(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2-1-3.5-3-4.5" /></>);
const Eye = () => svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>);
const Download = () => svg(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 19h16" /></>);
const Info = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>);
const Search = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" /></>);
const Check = () => svg(<><path d="M5 12l5 5 9-11" /></>);
const X = () => svg(<><path d="M6 6l12 12M18 6 6 18" /></>);
