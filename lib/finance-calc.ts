// Canonical per-student finance rules — the single source of truth for how invoices + approved
// payments + approved refunds turn into outstanding / optional-due / credit. Pure (no DB), so it can
// be reused and unit-tested. The agreed policy:
//   - Approved payments cover MANDATORY fees first, then OPTIONAL fees, then become CREDIT.
//   - "Outstanding" (what blocks clearance) is only the unpaid MANDATORY portion.
//   - Credit = anything paid beyond everything invoiced, net of approved refunds.
//
// Note: school-wide / per-class aggregates on the finance dashboard sum invoices and payments
// separately and therefore can't apply the mandatory-first rule per student — treat those as coarse
// totals, not the authoritative per-student balance computed here.
export type StudentFinance = {
  invoiced: number;
  mandatoryInvoiced: number;
  optionalInvoiced: number;
  paid: number;
  refunded: number;
  outstanding: number;
  optionalDue: number;
  credit: number;
};

export function computeStudentFinance(
  invoices: { amount: number; mandatory: boolean }[],
  approvedPaid: number,
  approvedRefunded: number,
): StudentFinance {
  const invoiced = invoices.reduce((n, i) => n + i.amount, 0);
  const mandatoryInvoiced = invoices.filter((i) => i.mandatory).reduce((n, i) => n + i.amount, 0);
  const optionalInvoiced = invoiced - mandatoryInvoiced;
  const paid = approvedPaid;
  const refunded = approvedRefunded;
  const outstanding = Math.max(0, mandatoryInvoiced - paid);
  const optionalDue = Math.max(0, optionalInvoiced - Math.max(0, paid - mandatoryInvoiced));
  const credit = Math.max(0, paid - invoiced - refunded);
  return { invoiced, mandatoryInvoiced, optionalInvoiced, paid, refunded, outstanding, optionalDue, credit };
}
