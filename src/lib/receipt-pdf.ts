import { formatAmount, formatDateTime } from "./format";
import { API_URL, authHeaders } from "./auth";
import { logoJpeg, receiptPdf, type Logo } from "./pdf";
import { CHANNEL_LABEL, METHOD_PAY_LABEL } from "./status";
import type { Sale } from "./types";

const naira = (k: number) => `N${formatAmount(k)}`;

export type StoreHead = { name?: string | null; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null } | null | undefined;

/** The business logo as JPEG bytes for the PDF, or null if there is none or it cannot be fetched (offline, for instance). */
export async function fetchLogo(store: StoreHead): Promise<Logo | null> {
  if (!store?.logo_url) return null;
  try {
    const res = await fetch(`${API_URL}${store.logo_url}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await logoJpeg(URL.createObjectURL(await res.blob()));
  } catch { return null; }
}

/** Builds the sale's receipt (or invoice, when money is still owed) as a PDF file ready to attach or share. */
export async function saleReceiptFile(sale: Sale, store: StoreHead, payTo: string[] = []): Promise<File> {
  const payments = (sale.payments ?? []).filter((p) => !p.voided_at);
  const total = sale.total + (sale.deposit_total ?? 0);
  const invoice = sale.status !== "void" && sale.balance_due > 0;
  const totals: { label: string; value: string; bold?: boolean }[] = [];
  if (sale.discount_total > 0) totals.push({ label: "Discount", value: `-${naira(sale.discount_total)}` });
  if ((sale.deposit_total ?? 0) > 0) { totals.push({ label: "Goods", value: naira(sale.total) }, { label: "Container deposit", value: naira(sale.deposit_total ?? 0) }); }
  totals.push({ label: "Total", value: naira(total), bold: true });
  for (const p of payments) totals.push({ label: METHOD_PAY_LABEL[p.method] ?? p.method, value: naira(p.amount) });
  if (sale.balance_due > 0 && sale.status === "completed") totals.push({ label: "Balance owed", value: naira(sale.balance_due), bold: true });

  const blob = receiptPdf({
    business: { name: store?.name ?? "", lines: [store?.address, store?.phone && `Tel: ${store.phone}`, store?.email && `Email: ${store.email}`].filter(Boolean) as string[] },
    title: sale.status === "void" ? "VOID RECEIPT" : invoice ? "INVOICE" : "RECEIPT",
    number: sale.number, when: formatDateTime(sale.sold_at),
    meta: [["Customer", sale.customer?.name ?? "Walk-in"], ["Served by", sale.creator?.name ?? "-"], ["Type", CHANNEL_LABEL[sale.channel] ?? sale.channel]],
    items: (sale.lines ?? []).map((l) => ({
      name: l.product?.name ?? "Item", total: formatAmount(l.line_total),
      detail: `${l.quantity} ${l.unit?.name ?? ""} x ${formatAmount(l.unit_price)}${l.unit_price < l.list_price ? ` (was ${formatAmount(l.list_price)})` : ""}${l.mix_label ? ` - ${l.mix_label}` : ""}`.replace(/\s+/g, " "),
    })),
    totals,
    note: invoice && payTo.length ? `Please pay into: ${payTo.join("; ")}` : undefined,
    footer: invoice ? "Please send your payment confirmation once done. Thank you." : "Thank you for your patronage.",
  }, await fetchLogo(store));

  return new File([blob], `${invoice ? "invoice" : "receipt"}-${sale.number}.pdf`, { type: "application/pdf" });
}
