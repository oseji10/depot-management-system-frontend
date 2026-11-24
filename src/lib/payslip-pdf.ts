import { formatAmount, formatDateTime } from "./format";
import { receiptPdf } from "./pdf";
import { monthLabel } from "./payroll";
import { fetchLogo, type StoreHead } from "./receipt-pdf";
import type { PayrollRun, Payslip } from "./types";

const naira = (k: number) => `N${formatAmount(k)}`;

/** One staff member's payslip as a PDF file, ready to print, save or send on WhatsApp. */
export async function payslipFile(p: Payslip, run: Pick<PayrollRun, "number" | "period" | "paid_at" | "pay_method">, store: StoreHead): Promise<File> {
  const earnings = p.lines.filter((l) => l.kind === "earning");
  const deductions = p.lines.filter((l) => l.kind === "deduction");
  const bank = [p.employee.bank_name, p.employee.account_number].filter(Boolean).join(" ");

  const blob = receiptPdf({
    business: { name: store?.name ?? "", lines: [store?.address, store?.phone && `Tel: ${store.phone}`, store?.email && `Email: ${store.email}`].filter(Boolean) as string[] },
    title: "PAYSLIP",
    number: monthLabel(run.period),
    when: run.number,
    meta: [
      ["Employee", p.employee.name],
      ["Staff no", p.employee.staff_no],
      ...(p.employee.job_title ? [["Position", p.employee.job_title] as [string, string]] : []),
      ["Paid to", bank || "No bank details"],
      ...(p.employee.account_name ? [["Account name", p.employee.account_name] as [string, string]] : []),
    ],
    items: [],
    groups: [
      { title: "Earnings", rows: earnings.map((l) => [l.label, formatAmount(l.amount)]), total: ["Gross pay", formatAmount(p.gross)] },
      { title: "Deductions", rows: deductions.map((l) => [l.label, `-${formatAmount(l.amount)}`]), total: ["Total deductions", `-${formatAmount(p.charges_total + p.other_deductions)}`] },
    ],
    totals: [{ label: "NET PAY", value: naira(p.net), bold: true }],
    note: run.paid_at ? `Paid ${formatDateTime(run.paid_at)}${run.pay_method ? ` by ${run.pay_method}` : ""}.` : "Not yet paid.",
    footer: "This payslip is confidential. Thank you for your work.",
  }, await fetchLogo(store));

  const slug = p.employee.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new File([blob], `payslip-${run.period}-${slug || p.employee.staff_no}.pdf`, { type: "application/pdf" });
}
