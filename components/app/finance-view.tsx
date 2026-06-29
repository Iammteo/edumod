"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFinanceData, recordPayment, approvePayment, rejectPayment, createFeeStructure, type FinanceData, type Payment, type Student } from "@/lib/actions/finance";
import { useClassNames } from "@/components/app/use-classes";
import { ClassFinanceView } from "./class-finance";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export type FinanceSection = "overview" | "record" | "approvals" | "bills" | "invoices" | "classsummary" | "overpayments" | "reports";
const SECTION_HEAD: Record<FinanceSection, [string, string]> = {
  overview: ["Finance overview", "Collections, approvals and outstanding at a glance."],
  record: ["Record payment", "Record a payment towards a student's invoice or fee."],
  approvals: ["Approvals", "Review and approve payments under maker-checker control."],
  bills: ["Bills & fee structures", "Create and issue bills to students and classes."],
  invoices: ["Invoices & receipts", "Create, manage and share invoices with parents and guardians."],
  classsummary: ["Class finance summary", "Monitor class collections, outstanding balances and payment performance."],
  overpayments: ["Overpayments & refunds", "Track credit balances and process refunds."],
  reports: ["Reports & exports", "Export financial reports for any period."],
};
function FinHead({ section }: { section: FinanceSection }) {
  const [t, s] = SECTION_HEAD[section];
  return <div className="mb-5"><div className="text-[11px] font-extrabold text-brand-blue">Finance</div><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">{t}</h1><p className="mt-0.5 text-[13px] text-ink-soft">{s}</p></div>;
}

export function FinanceArea({ section }: { section: FinanceSection }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await getFinanceData(); if ("error" in r) setErr(r.error); else setData(r); }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const flash = (m: string) => { setOk(m); setErr(null); setTimeout(() => setOk((v) => (v === m ? null : v)), 3500); };

  if (section === "classsummary") return <ClassFinanceView />;
  if (!data) return <div className="grid place-items-center gap-3 py-20 text-[13px] text-ink-soft">{err ? <><p className="font-bold text-[#b3261e]">{err}</p><button onClick={load} className="rounded-[10px] bg-brand-blue px-4 py-2 text-[12px] font-extrabold text-white">Retry</button></> : "Loading finance…"}</div>;

  const banners = <>{err && <div className="mb-4 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e]">{err}</div>}{ok && <div className="mb-4 rounded-[12px] border border-brand-green/30 bg-brand-green/10 px-3.5 py-2.5 text-[12px] font-bold text-brand-green">{ok}</div>}</>;
  const noAccess = <div className="rounded-2xl border border-border-soft bg-paper/60 px-4 py-4 text-[12px] font-bold text-ink-soft">This action is available to an <span className="text-ink">admin, bursar, principal or vice-principal</span>.</div>;

  return (
    <>
      <FinHead section={section} />
      {banners}
      {section === "record" && (data.canRecord ? <RecordPaymentScreen data={data} onDone={() => { flash("Payment submitted for approval."); load(); }} onErr={setErr} /> : noAccess)}
      {section === "approvals" && <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><PaymentsQueueCard data={data} /><ApprovalCard data={data} onApprove={async (id) => { const r = await approvePayment(id); if ("error" in r) setErr(r.error); else { flash("Payment approved - receipt issued."); load(); } }} onReject={async (id) => { const reason = window.prompt("Reason for returning/declining this payment?"); if (reason === null) return; const r = await rejectPayment(id, reason); if ("error" in r) setErr(r.error); else { flash("Payment returned."); load(); } }} scrollAll={() => {}} /></div>}
      {section === "bills" && (data.canRecord ? <IssueFeesCard data={data} onDone={(n) => { flash(`Fee issued - ${n} invoice${n === 1 ? "" : "s"} created.`); load(); }} onErr={setErr} /> : noAccess)}
      {section === "invoices" && <InvoicesReceiptsCard data={data} onGenerateInvoice={() => {}} onGenerateReceipt={() => {}} />}
      {(section === "overpayments" || section === "reports") && <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-20 text-center"><div className="mb-2 text-3xl">🛠️</div><p className="text-[14px] font-bold text-ink">Coming soon</p><p className="mt-1 text-[12px] text-ink-soft">{SECTION_HEAD[section][1]}</p></div>}
      {section === "overview" && <FinanceView initial={data} />}
    </>
  );
}

// New two-column Record payment screen: form on the left, live student summary on the right.
function RecordPaymentScreen({ data, onDone, onErr }: { data: FinanceData; onDone: () => void; onErr: (e: string) => void }) {
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
    onDone();
  }

  const REQ = <span className="text-[#e5484d]">*</span>;
  return (
    <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_400px]">
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
              <Field label={<>Amount paid (₦) {REQ}</>}><div className="flex items-center rounded-[10px] border border-border-soft bg-paper/60 focus-within:border-brand-blue"><span className="grid h-10 w-9 place-items-center text-ink-soft">₦</span><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required placeholder="0" className="min-h-10 w-full rounded-r-[10px] bg-transparent pr-3 text-[13px] outline-none" /></div>{selInvoice && <p className="mt-1 text-[11px] font-bold text-ink-soft">Outstanding: <span className="text-[#b9540f]">{naira(selInvoice.outstanding)}</span></p>}</Field>
              <Field label={<>Payment date {REQ}</>}><input type="date" value={payDate} max={todayStr()} onChange={(e) => setPayDate(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label={<>Payment method {REQ}</>}>
              <div className="grid grid-cols-2 gap-2.5">
                {(["cash", "transfer"] as const).map((m) => <button key={m} type="button" onClick={() => setMethod(m)} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border text-[13px] font-extrabold transition ${method === m ? "border-brand-blue bg-brand-soft text-brand-blue" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue"}`}>{m === "cash" ? <Card2 /> : <Bank />}{m === "cash" ? "Cash" : "Transfer"}</button>)}
              </div>
            </Field>
            {method === "transfer" && <Field label="Bank reference / Cheque no."><input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="e.g. GTB Ref: 1234567890" className={inputCls} /></Field>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<>Proof of payment {method === "transfer" ? <span className="text-[#b9540f]">(required)</span> : <span className="font-bold text-ink-soft">(optional)</span>}</>}>
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
            <div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-full font-bold text-white" style={{ backgroundColor: AV[student.name.length % AV.length] }}>{initials(student.name)}</span><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-display text-[15px] font-semibold">{student.name}</span><span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-green">Active</span></div><div className="text-[11px] text-ink-soft">{student.admissionNo}{student.className ? ` · ${student.className}` : ""}</div></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-soft pt-3 text-center">
              <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Expected</div><div className="mt-0.5 font-display text-[14px] font-bold text-ink">{naira(expected)}</div></div>
              <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Paid</div><div className="mt-0.5 font-display text-[14px] font-bold text-brand-green">{naira(paid)}</div></div>
              <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Outstanding</div><div className="mt-0.5 font-display text-[14px] font-bold text-[#b9540f]">{naira(outstanding)}</div></div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3 text-[12px]"><span className="font-bold text-ink-soft">Credit balance</span><span className="font-extrabold text-brand-blue">{naira(credit)}</span></div>
          </section>

          <section className="rounded-2xl border border-border-soft bg-white p-5">
            <h3 className="mb-3 font-display text-[14px] font-semibold">Recent payments</h3>
            {recent.length === 0 ? <p className="text-[11px] text-ink-soft">No payments recorded yet.</p> : <ul className="grid gap-2">{recent.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 text-[12px]"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-brand-green/10 text-brand-green"><Card2 /></span><div><div className="font-bold text-ink">{p.date}</div><div className="text-[10px] text-ink-soft capitalize">{p.method}</div></div></div><div className="flex items-center gap-2"><span className="font-bold text-ink">{naira(p.amount)}</span><Pill tone={p.status === "approved" ? "green" : p.status === "pending_approval" ? "amber" : "red"}>{p.status === "approved" ? "Approved" : p.status === "pending_approval" ? "Pending" : "Rejected"}</Pill></div></li>)}</ul>}
          </section>

          <section className="rounded-2xl border border-border-soft bg-white p-5">
            <h3 className="mb-3 font-display text-[14px] font-semibold">Invoice preview</h3>
            {studentInvoices.length === 0 ? <p className="text-[11px] text-ink-soft">No invoices for this student yet.</p> : <>
              <table className="w-full text-left text-[11px]"><thead><tr className="border-b border-border-soft text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5 font-bold">Description</th><th className="py-1.5 text-right font-bold">Amount</th></tr></thead><tbody>{studentInvoices.slice(0, 8).map((i) => <tr key={i.id} className="border-b border-border-soft last:border-0"><td className="py-1.5 font-bold text-ink">{i.description}</td><td className="py-1.5 text-right text-ink-soft">{naira(i.amount)}</td></tr>)}</tbody></table>
              <div className="mt-2 flex items-center justify-between border-t border-border-soft pt-2 text-[12px] font-extrabold"><span>Total</span><span>{naira(expected)}</span></div>
            </>}
          </section>
        </>}
      </div>
    </div>
  );
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const compact = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${n}`);
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const AV = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0f8a8a", "#c0392b"];
const FEE_TYPES = ["Tuition", "Practical", "Lesson money", "Transport", "PTA"];
const TERMS = ["2023/2024 · Term 1", "2023/2024 · Term 2", "2023/2024 · Term 3", "2024/2025 · Term 1"];

export function FinanceView({ initial }: { initial?: FinanceData }) {
  const [data, setData] = useState<FinanceData | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getFinanceData();
    if ("error" in r) setErr(r.error);
    else { setData(r); }
  }, []);
  // Live: refresh on mount and every 5s so approvals/payments by anyone appear in near real-time.
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const flash = (msg: string) => { setOk(msg); setErr(null); setTimeout(() => setOk((v) => (v === msg ? null : v)), 3500); };

  if (!data) return <div className="grid place-items-center gap-3 py-20 text-[13px] text-ink-soft">{err ? <><p className="font-bold text-[#b3261e]">{err}</p><button onClick={load} className="rounded-[10px] bg-brand-blue px-4 py-2 text-[12px] font-extrabold text-white">Retry</button></> : "Loading finance…"}</div>;
  const s = data.stats;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const stats: { label: string; value: string; sub: string; color: string; bg: string; icon: React.ReactNode }[] = [
    { label: "Total collected", value: compact(s.collected), sub: `${s.receiptsIssued} approved payments`, color: "#178a4c", bg: "#e7f6ee", icon: <Wallet /> },
    { label: "Outstanding", value: compact(s.outstanding), sub: `${s.outstandingCount} invoices`, color: "#b9540f", bg: "#fbeee3", icon: <Alert /> },
    { label: "Pending approval", value: compact(s.pending), sub: `${s.pendingCount} payments`, color: "#6b2fb3", bg: "#f0e9fa", icon: <Clock /> },
    { label: "This month", value: compact(s.thisMonth), sub: "Approved this month", color: "#2159e8", bg: "#e7eefc", icon: <Chart /> },
    { label: "Receipts issued", value: String(s.receiptsIssued), sub: "This term", color: "#178a4c", bg: "#e7f6ee", icon: <Receipt /> },
  ];

  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2"><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Finance management</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-1 text-[10px] font-extrabold text-brand-green"><span className="size-1.5 animate-pulse rounded-full bg-brand-green" />Live</span></div>
          <p className="mt-0.5 text-[13px] text-ink-soft">Manage payments, issue fees, and track approvals with maker-checker control.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative grid size-10 place-items-center rounded-[12px] border border-border-soft bg-white text-ink-soft">{<Bell />}{s.pendingCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[#e5484d] px-1 text-[10px] font-extrabold text-white">{s.pendingCount}</span>}</span>
          {data.canRecord && <button onClick={() => scrollTo("issue-card")} className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] border border-border-soft bg-white px-4 text-[13px] font-extrabold text-ink transition hover:border-brand-blue hover:text-brand-blue"><Doc />Issue fees</button>}
          {data.canRecord && <button onClick={() => scrollTo("record-card")} className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark"><Card2 />Record payment</button>}
        </div>
      </div>

      {err && <div className="mb-4 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e]">{err}</div>}
      {ok && <div className="mb-4 rounded-[12px] border border-brand-green/30 bg-brand-green/10 px-3.5 py-2.5 text-[12px] font-bold text-brand-green">{ok}</div>}
      {!data.canRecord && <div className="mb-4 rounded-[12px] border border-border-soft bg-paper/60 px-3.5 py-2.5 text-[12px] font-bold text-ink-soft">You can view payments and approvals here. Recording payments and issuing fees is available to an <span className="text-ink">admin, bursar, principal or vice-principal</span>.</div>}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((st) => (
          <div key={st.label} className="rounded-2xl border border-border-soft bg-white p-3.5 sm:p-[18px]">
            <span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.icon}</span>
            <strong className="mt-2.5 block break-words font-display text-[clamp(17px,5vw,24px)] font-semibold leading-none">{st.value}</strong>
            <small className="mt-1.5 block font-bold text-ink-soft">{st.label}</small>
            <div className="mt-1 hidden text-[11px] font-bold text-ink-soft sm:block">{st.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-[18px] grid gap-[18px] lg:grid-cols-2 xl:grid-cols-3">
        {data.canRecord && <RecordPaymentCard data={data} onDone={() => { flash("Payment submitted for approval."); load(); }} onErr={setErr} />}
        <ApprovalCard data={data} onApprove={async (id) => { const r = await approvePayment(id); if ("error" in r) setErr(r.error); else { flash("Payment approved - receipt issued."); load(); } }} onReject={async (id) => { const reason = window.prompt("Reason for rejecting this payment?"); if (reason === null) return; const r = await rejectPayment(id, reason); if ("error" in r) setErr(r.error); else { flash("Payment rejected."); load(); } }} scrollAll={() => scrollTo("payments-table")} />
        {data.canRecord && <IssueFeesCard data={data} onDone={(n) => { flash(`Fee issued - ${n} invoice${n === 1 ? "" : "s"} created.`); load(); }} onErr={setErr} />}
      </div>

      <div className="mt-[18px] grid gap-[18px] lg:grid-cols-2">
        <InvoicesReceiptsCard data={data} onGenerateInvoice={() => scrollTo("issue-card")} onGenerateReceipt={() => scrollTo("record-card")} />
        <PaymentsQueueCard data={data} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------- Record a payment
function RecordPaymentCard({ data, onDone, onErr }: { data: FinanceData; onDone: () => void; onErr: (e: string) => void }) {
  const [studentId, setStudentId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [proofName, setProofName] = useState<string | null>(null);

  const openForStudent = useMemo(() => data.openInvoices.filter((i) => i.studentId === studentId), [data.openInvoices, studentId]);
  const selInvoice = openForStudent.find((i) => i.id === invoiceId) || null;

  function pickStudent(id: string) { setStudentId(id); setInvoiceId(""); }
  function pickInvoice(id: string) { setInvoiceId(id); const inv = data.openInvoices.find((i) => i.id === id); if (inv) setAmount(String(inv.outstanding)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) { onErr("Please select a student."); return; }
    const proof = fileRef.current?.files?.[0];
    if (method === "transfer" && !proof) { onErr("Proof of payment is required for transfers."); return; }
    const fd = new FormData();
    fd.set("studentId", studentId);
    if (invoiceId) fd.set("invoiceId", invoiceId);
    fd.set("amount", amount);
    fd.set("method", method);
    fd.set("description", selInvoice?.description ?? "");
    if (proof) fd.set("proof", proof);
    setBusy(true);
    const r = await recordPayment(fd);
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setStudentId(""); setInvoiceId(""); setAmount(""); setMethod("cash"); setProofName(null); if (fileRef.current) fileRef.current.value = "";
    onDone();
  }

  return (
    <section id="record-card" className="rounded-2xl border border-border-soft bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold"><span className="text-brand-green"><Card2 /></span>Record a payment</h2>
      {data.students.length === 0 ? <p className="text-[12px] text-ink-soft">Add students first (Students tab) before recording payments.</p> : (
        <form onSubmit={submit} className="grid gap-3.5">
          <Field label="Student"><StudentPicker students={data.students} value={studentId} onChange={pickStudent} /></Field>
          <div className="grid gap-3.5 sm:grid-cols-[1.4fr_1fr]">
            <Field label="Fee / Invoice">
              <select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)} disabled={!studentId} className={selectCls}>
                <option value="">General payment (no invoice)</option>
                {openForStudent.map((i) => <option key={i.id} value={i.id}>{i.description} ({i.no}) - due {naira(i.outstanding)}</option>)}
              </select>
              {selInvoice && <p className="mt-1 text-[11px] font-bold text-ink-soft">Outstanding: <span className="text-[#b9540f]">{naira(selInvoice.outstanding)}</span></p>}
              {studentId && openForStudent.length === 0 && <p className="mt-1 text-[11px] text-ink-soft">No open invoices for this student.</p>}
            </Field>
            <Field label="Amount (₦)"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required placeholder="120000" className={inputCls} /></Field>
          </div>
          <Field label="Payment method">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMethod("cash")} className={`min-h-10 rounded-[10px] border text-[13px] font-extrabold transition ${method === "cash" ? "border-brand-blue bg-brand-soft text-brand-blue" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue"}`}>Cash</button>
              <button type="button" onClick={() => setMethod("transfer")} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-extrabold transition ${method === "transfer" ? "border-brand-blue bg-brand-soft text-brand-blue" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue"}`}><Bank />Transfer</button>
            </div>
          </Field>
          <Field label={<>Proof of payment {method === "transfer" ? <span className="text-[#b9540f]">(required for transfer)</span> : <span className="font-bold text-ink-soft">(optional)</span>}</>}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-dashed border-border-soft bg-paper/50 px-3.5 py-3 transition hover:border-brand-blue">
              <span className="flex items-center gap-2.5 text-[12px] text-ink-soft"><span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-blue"><Upload /></span><span><span className="block font-bold text-ink">{proofName ?? "Upload screenshot or receipt"}</span><span className="text-[11px]">PNG, JPG or PDF (max 5MB)</span></span></span>
              <span className="rounded-[8px] border border-border-soft bg-white px-3 py-1.5 text-[11px] font-extrabold text-ink-soft">Choose file</span>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setProofName(e.target.files?.[0]?.name ?? null)} />
            </label>
          </Field>
          <div className="flex flex-col items-center justify-between gap-3 rounded-[12px] bg-brand-soft/40 p-3.5 sm:flex-row">
            <p className="text-[11px] leading-relaxed text-ink-soft"><span className="font-extrabold text-ink">This payment will be submitted for approval.</span><br />Approval will be handled by a different designated staff member.</p>
            <button type="submit" disabled={busy} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70"><Send />{busy ? "Submitting…" : "Submit for approval"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------- Approval workflow
function ApprovalCard({ data, onApprove, onReject, scrollAll }: { data: FinanceData; onApprove: (id: string) => void; onReject: (id: string) => void; scrollAll: () => void }) {
  const pending = data.payments.filter((p) => p.status === "pending_approval");
  const steps = [["1", "Recorded", "By bursar"], ["2", "Awaiting", "Approver"], ["3", "Approved", "By approver"], ["4", "Issued", "Receipt generated"]];
  return (
    <section className="rounded-2xl border border-border-soft bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold"><span className="text-brand-blue"><Shield /></span>Approval workflow</h2>
      <div className="mb-5 flex items-start justify-between">
        {steps.map(([n, t, sub], i) => (
          <div key={n} className="relative flex flex-1 flex-col items-center text-center">
            {i < steps.length - 1 && <span className="absolute left-1/2 top-3.5 -z-0 h-0.5 w-full bg-border-soft" />}
            <span className={`relative z-10 grid size-7 place-items-center rounded-full text-[11px] font-extrabold ${i === 0 ? "bg-brand-blue text-white" : i === 1 ? "bg-[#f0e9fa] text-[#6b2fb3]" : "bg-paper text-ink-soft ring-1 ring-border-soft"}`}>{n}</span>
            <span className="mt-1.5 text-[11px] font-extrabold text-ink">{t}</span>
            <span className="text-[10px] text-ink-soft">{sub}</span>
          </div>
        ))}
      </div>
      <div className="mb-2.5 flex items-center justify-between"><span className="text-[12px] font-extrabold text-ink">Pending approvals</span><button onClick={scrollAll} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all ({pending.length})</button></div>
      {pending.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-8 text-[12px] text-ink-soft">Nothing awaiting approval. 🎉</div> : (
        <ul className="grid gap-2">
          {pending.slice(0, 4).map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border-soft p-2.5">
              <Avatar name={p.student} />
              <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-ink">{p.student}</div><div className="truncate text-[10px] text-ink-soft">{p.description || "Payment"} · {p.recordedBy}{p.mine && " (you)"}</div></div>
              <div className="text-right"><div className="text-[12px] font-extrabold text-ink">{naira(p.amount)}</div><div className="text-[10px] capitalize text-ink-soft">{p.method}</div></div>
              {data.canApprove && (!p.mine || !data.requireApproval) ? (
                <div className="flex shrink-0 gap-1"><button onClick={() => onApprove(p.id)} title="Approve" className="grid size-7 place-items-center rounded-md bg-brand-green/10 text-brand-green hover:bg-brand-green/20"><Check /></button><button onClick={() => onReject(p.id)} title="Reject" className="grid size-7 place-items-center rounded-md bg-[#fdeeee] text-[#b3261e] hover:bg-[#fbe3e3]"><X /></button></div>
              ) : <Pill tone="amber">{p.mine ? "Needs another approver" : "Pending"}</Pill>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-ink-soft">{data.requireApproval ? "Maker-checker is on - a different staff member must approve each payment. Change this in Settings." : "Maker-checker is off - whoever has approval rights can approve, including the recorder. Turn on a separate approver in Settings."}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------- Issue fees
type ItemDraft = { name: string; amount: string; mandatory: boolean };
function IssueFeesCard({ data, onDone, onErr }: { data: FinanceData; onDone: (n: number) => void; onErr: (e: string) => void }) {
  const [billName, setBillName] = useState("");
  const [term, setTerm] = useState(TERMS[1]);
  const [items, setItems] = useState<ItemDraft[]>([{ name: "Tuition", amount: "", mandatory: true }]);
  const [classes, setClasses] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const allClassNames = useClassNames();

  const countMap = useMemo(() => new Map(data.classCounts.map((c) => [c.className, c.count])), [data.classCounts]);
  const invoiced = classes.length === 0 ? data.students.length : classes.reduce((n, c) => n + (countMap.get(c) ?? 0), 0);
  const perStudent = items.reduce((n, it) => n + (Number(it.amount) || 0), 0);
  const mandatoryPer = items.filter((it) => it.mandatory).reduce((n, it) => n + (Number(it.amount) || 0), 0);
  const optionalPer = perStudent - mandatoryPer;
  const remaining = allClassNames.filter((c) => !classes.includes(c));
  const setItem = (i: number, patch: Partial<ItemDraft>) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = billName.trim() || term;
    const payload = items.map((it) => ({ name: it.name.trim(), amount: Number(it.amount), mandatory: it.mandatory })).filter((it) => it.name && it.amount > 0);
    if (payload.length === 0) { onErr("Add at least one fee item with an amount."); return; }
    setBusy(true);
    const r = await createFeeStructure({ name, termLabel: term, classes, items: payload });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setBillName(""); setItems([{ name: "Tuition", amount: "", mandatory: true }]); setClasses([]);
    onDone(r.issued);
  }

  return (
    <section id="issue-card" className="rounded-2xl border border-border-soft bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-[16px] font-semibold"><span className="text-brand-green"><Doc /></span>Issue fees / create bill</h2>
      <form onSubmit={submit} className="grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Bill name"><input value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="e.g. Term 1 fees" className={inputCls} /></Field>
          <Field label="Term"><select value={term} onChange={(e) => setTerm(e.target.value)} className={selectCls}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between"><span className="text-[11px] font-extrabold text-ink">Fee breakdown</span><span className="text-[10px] text-ink-soft">Mark each item mandatory or optional</span></div>
          <datalist id="fee-item-names">{FEE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          <div className="grid gap-2">
            {items.map((it, i) => (
              <div key={i} className="grid gap-2 rounded-[10px] border border-border-soft bg-paper/40 p-2">
                <input list="fee-item-names" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Item (e.g. Excursion)" className="min-h-9 w-full rounded-[8px] border border-border-soft bg-white px-2.5 text-[12px] outline-none focus:border-brand-blue" />
                <div className="flex items-center gap-2">
                  <input value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} type="number" min="0" step="0.01" placeholder="Amount ₦" className="min-h-9 flex-1 rounded-[8px] border border-border-soft bg-white px-2.5 text-[12px] outline-none focus:border-brand-blue" />
                  <button type="button" onClick={() => setItem(i, { mandatory: !it.mandatory })} className={`min-h-9 shrink-0 rounded-full px-3 text-[10px] font-extrabold transition ${it.mandatory ? "bg-brand-blue text-white" : "bg-[#fdf6e9] text-[#b9540f]"}`}>{it.mandatory ? "Mandatory" : "Optional"}</button>
                  <button type="button" onClick={() => setItems((a) => a.length > 1 ? a.filter((_, idx) => idx !== i) : a)} disabled={items.length === 1} className="grid size-9 shrink-0 place-items-center rounded-[8px] text-ink-soft hover:bg-paper disabled:opacity-30" title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((a) => [...a, { name: "", amount: "", mandatory: true }])} className="mt-2 text-[12px] font-extrabold text-brand-blue hover:underline">+ Add fee item</button>
        </div>

        <Field label="Classes">
          <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border-soft bg-paper/50 p-2">
            {classes.length === 0
              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue px-2.5 py-1 text-[11px] font-extrabold text-white">🏫 All classes · every student</span>
              : classes.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-blue">{c}<button type="button" onClick={() => setClasses((v) => v.filter((x) => x !== c))} className="text-brand-blue/70 hover:text-brand-blue">✕</button></span>)}
            {remaining.length > 0 && <select value="" onChange={(e) => { if (e.target.value) setClasses((v) => [...v, e.target.value]); }} className="ml-auto rounded-md border border-border-soft bg-white px-2 py-1 text-[11px] font-bold text-ink-soft outline-none"><option value="">+ Add class</option>{remaining.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
            {classes.length > 0 && <button type="button" onClick={() => setClasses([])} className="text-[11px] font-extrabold text-ink-soft underline hover:text-ink">All classes</button>}
          </div>
          <p className="mt-1 px-1 text-[10px] text-ink-soft">Add classes to bill only those, or leave as <strong>All classes</strong> to bill every student.</p>
        </Field>

        <div className="rounded-[12px] border border-border-soft bg-paper/50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand-blue"><Users /></span><div><div className="text-[12px] font-extrabold text-ink">{naira(perStudent)} / student</div><div className="text-[11px] text-ink-soft">{naira(mandatoryPer)} mandatory{optionalPer > 0 ? ` · ${naira(optionalPer)} optional` : ""} · {invoiced.toLocaleString()} student{invoiced === 1 ? "" : "s"}</div></div></div>
            <div className="text-right"><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Total to issue</div><div className="font-display text-[18px] font-bold text-brand-green">{naira(perStudent * invoiced)}</div></div>
          </div>
        </div>
        <button type="submit" disabled={busy || invoiced === 0} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60"><Doc />{busy ? "Issuing…" : "Create and issue bill"}</button>
        {invoiced === 0 && <p className="-mt-1 text-center text-[11px] text-ink-soft">No students in the selected class(es) yet.</p>}
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------- Invoices & receipts
function InvoicesReceiptsCard({ data, onGenerateInvoice, onGenerateReceipt }: { data: FinanceData; onGenerateInvoice: () => void; onGenerateReceipt: () => void }) {
  const [tab, setTab] = useState<"invoices" | "receipts">("invoices");
  const invTone = (s: string): "green" | "amber" | "red" => (s === "paid" ? "green" : s === "partially_paid" ? "amber" : "red");
  const invLabel = (s: string) => (s === "paid" ? "Paid" : s === "partially_paid" ? "Partially paid" : "Unpaid");
  return (
    <section className="flex flex-col rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-[16px] font-semibold"><span className="text-brand-green"><Receipt /></span>Invoices &amp; receipts</h2></div>
      <div className="mb-3 flex gap-4 border-b border-border-soft">
        {(["invoices", "receipts"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2 text-[12px] font-extrabold capitalize transition ${tab === t ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-soft hover:text-ink"}`}>Recent {t}</button>)}
      </div>
      <div className="flex-1">
        {tab === "invoices" ? (
          data.invoices.length === 0 ? <Empty>No invoices yet. Issue a fee to create some.</Empty> : (
            <ul className="grid gap-1.5">{data.invoices.slice(0, 5).map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border-soft p-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fbeee3] text-[#b9540f]"><Receipt /></span>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><code className="text-[11px] font-extrabold text-ink">{i.no}</code><Pill tone={invTone(i.status)}>{invLabel(i.status)}</Pill></div><div className="truncate text-[11px] text-ink-soft">{i.student} · {i.description} · {i.date}</div></div>
                <div className="shrink-0 text-right text-[12px] font-extrabold text-ink">{naira(i.amount)}</div>
              </li>
            ))}</ul>
          )
        ) : (
          data.receipts.length === 0 ? <Empty>No receipts yet. Approved payments appear here.</Empty> : (
            <ul className="grid gap-1.5">{data.receipts.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border-soft p-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-green/10 text-brand-green"><Receipt /></span>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><code className="text-[11px] font-extrabold text-ink">{r.no}</code><Pill tone="blue">Issued</Pill></div><div className="truncate text-[11px] text-ink-soft">{r.student} · {r.method} · {r.date}</div></div>
                <div className="shrink-0 text-right text-[12px] font-extrabold text-ink">{naira(r.amount)}</div>
                {r.token && <a href={`/r/${r.token}`} target="_blank" rel="noreferrer" title="Open receipt" className="grid size-7 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Download /></a>}
              </li>
            ))}</ul>
          )
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-soft pt-4">
        <button onClick={onGenerateInvoice} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-border-soft text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft"><Doc />Generate invoice</button>
        <button onClick={onGenerateReceipt} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-border-soft text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft"><Receipt />Generate receipt</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------- Payments queue table
function PaymentsQueueCard({ data }: { data: FinanceData }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const per = 5;
  const filtered = useMemo(() => data.payments.filter((p) => filter === "all" || p.status === filter), [data.payments, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * per, cur * per);
  return (
    <section id="payments-table" className="flex flex-col rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold"><span className="text-brand-green"><Card2 /></span>Recent payments &amp; approval queue</h2>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="rounded-[10px] border border-border-soft bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-soft outline-none"><option value="all">All</option><option value="pending_approval">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
      </div>
      {filtered.length === 0 ? <Empty>No payments yet.</Empty> : (
        <div className="-mx-2 flex-1 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12px] md:min-w-[640px]">
            <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2 font-bold">Student</th><th className="hidden px-2 py-2 font-bold sm:table-cell">Fee type</th><th className="px-2 py-2 font-bold">Amount</th><th className="hidden px-2 py-2 font-bold lg:table-cell">Method</th><th className="hidden px-2 py-2 font-bold lg:table-cell">Recorded by</th><th className="hidden px-2 py-2 font-bold lg:table-cell">Approver</th><th className="px-2 py-2 font-bold">Status</th><th className="hidden px-2 py-2 font-bold md:table-cell">Date</th><th className="px-2 py-2 text-right font-bold">Action</th></tr></thead>
            <tbody>{slice.map((p) => (
              <tr key={p.id} className="border-b border-border-soft last:border-0 hover:bg-paper/60">
                <td className="px-2 py-2.5 font-bold text-ink">{p.student}</td>
                <td className="hidden px-2 py-2.5 text-ink-soft sm:table-cell">{p.description || "-"}</td>
                <td className="px-2 py-2.5 font-extrabold text-ink">{naira(p.amount)}</td>
                <td className="hidden px-2 py-2.5 capitalize text-ink-soft lg:table-cell">{p.method}</td>
                <td className="hidden px-2 py-2.5 text-ink-soft lg:table-cell">{p.recordedBy}</td>
                <td className="hidden px-2 py-2.5 text-ink-soft lg:table-cell">{p.approver ?? <span className="text-ink-soft/60">-</span>}</td>
                <td className="px-2 py-2.5"><Pill tone={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "amber"}>{p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending approval"}</Pill></td>
                <td className="hidden px-2 py-2.5 text-ink-soft md:table-cell">{p.date}</td>
                <td className="px-2 py-2.5"><div className="flex justify-end gap-1">
                  {p.proofKey && <a href={p.proofKey} target="_blank" rel="noreferrer" title="View proof" className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Eye /></a>}
                  {p.status === "approved" && (p.receiptKey || p.id) && <a href={p.receiptKey ? `/r/${p.receiptKey}` : `/receipt/${p.id}`} target="_blank" rel="noreferrer" title="Receipt" className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-paper hover:text-brand-blue"><Download /></a>}
                  {!p.proofKey && p.status !== "approved" && <span className="text-ink-soft/50">-</span>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-[12px] text-ink-soft">
          <span>Showing {(cur - 1) * per + 1} to {Math.min(cur * per, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-1">
            <PageBtn onClick={() => setPage(Math.max(1, cur - 1))} disabled={cur === 1}>‹</PageBtn>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 4).map((n) => <PageBtn key={n} active={n === cur} onClick={() => setPage(n)}>{String(n)}</PageBtn>)}
            <PageBtn onClick={() => setPage(Math.min(pages, cur + 1))} disabled={cur === pages}>›</PageBtn>
          </div>
        </div>
      )}
    </section>
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
  const c = { green: "bg-brand-green/10 text-brand-green", red: "bg-[#fdeeee] text-[#b3261e]", amber: "bg-[#fdf6e9] text-[#b9540f]", blue: "bg-brand-soft text-brand-blue" }[tone];
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
const Alert = () => svg(<><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>);
const Clock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const Chart = () => svg(<><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" /></>);
const Receipt = () => svg(<><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1Z" /><path d="M9 8h6M9 12h6" /></>);
const Bell = () => svg(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" /><path d="M10 21h4" /></>);
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
