import { formatDate, formatKobo } from "./format";
import { METHOD_PAY_LABEL } from "./status";
import { monthLabel } from "./payroll";
import type { PayrollRun, Payslip, Sale } from "./types";

/** "0803 123 4567" or "+234 803…" as the digits WhatsApp wants (country code, no plus). Empty if it does not look like a number. */
export function whatsappNumber(raw?: string | null): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return "";
  if (d.startsWith("234")) return d;
  if (d.startsWith("0")) return `234${d.slice(1)}`;
  if (d.length === 10) return `234${d}`;
  return d;
}

/** A link that opens WhatsApp with the message ready to send. With no number it opens the contact chooser. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const n = whatsappNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

const money = (k: number) => formatKobo(k).replace(/ /g, " ");

/**
 * A receipt for a paid sale, or an invoice when something is still owed. `payTo` lists accounts to pay into (invoices only).
 */
export function saleMessage(sale: Sale, storeName: string, payTo: string[] = []): { text: string; invoice: boolean } {
  const live = sale.status !== "void";
  const total = sale.total + (sale.deposit_total ?? 0);
  const invoice = live && sale.balance_due > 0;
  const payments = (sale.payments ?? []).filter((p) => !p.voided_at);
  const out: string[] = [];

  out.push(`*${storeName}*`);
  out.push(`${invoice ? "INVOICE" : "RECEIPT"} ${sale.number}`);
  out.push(new Date(sale.sold_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }));
  if (sale.customer?.name) out.push(`Customer: ${sale.customer.name}`);
  out.push("");
  for (const l of sale.lines ?? []) out.push(`${l.quantity} ${l.unit?.name ?? ""} ${l.product?.name ?? ""} - ${money(l.line_total)}`.replace(/\s+/g, " "));
  if (sale.discount_total > 0) out.push(`Discount: -${money(sale.discount_total)}`);
  if ((sale.deposit_total ?? 0) > 0) out.push(`Container deposit: ${money(sale.deposit_total ?? 0)}`);
  out.push("");
  out.push(`*Total: ${money(total)}*`);

  if (invoice) {
    for (const p of payments) out.push(`Paid (${METHOD_PAY_LABEL[p.method]}): ${money(p.amount)}`);
    out.push(`*Amount due: ${money(sale.balance_due)}*`);
    if (payTo.length) { out.push(""); out.push("Please pay into:"); out.push(...payTo); }
    out.push(""); out.push("Please send your payment confirmation once done. Thank you.");
  } else if (!live) {
    out.push("This sale has been voided.");
  } else {
    for (const p of payments) out.push(`${METHOD_PAY_LABEL[p.method]}: ${money(p.amount)}`);
    out.push(""); out.push("Paid in full. Thank you for your business!");
  }

  return { text: out.join("\n"), invoice };
}

/** A payslip as a WhatsApp message. */
export function payslipMessage(p: Payslip, run: Pick<PayrollRun, "period" | "number" | "paid_at">, storeName: string): string {
  const out: string[] = [`*${storeName}*`, `PAYSLIP - ${monthLabel(run.period)}`, `${p.employee.name} (${p.employee.staff_no})`];
  if (p.employee.job_title) out.push(p.employee.job_title);
  out.push("", "*Earnings*");
  for (const l of p.lines.filter((x) => x.kind === "earning")) out.push(`${l.label}: ${money(l.amount)}`);
  out.push(`Gross pay: ${money(p.gross)}`);
  const ded = p.lines.filter((x) => x.kind === "deduction");
  if (ded.length) { out.push("", "*Deductions*"); for (const l of ded) out.push(`${l.label}: -${money(l.amount)}`); }
  out.push("", `*Net pay: ${money(p.net)}*`);
  out.push(run.paid_at ? `Paid ${formatDate(run.paid_at.slice(0, 10))}` : "Not yet paid");
  return out.join("\n");
}
