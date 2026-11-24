"use client";

import { saleReceiptFile, type StoreHead } from "../lib/receipt-pdf";
import { formatKobo } from "../lib/format";
import type { Sale } from "../lib/types";
import { WhatsAppPdfButton } from "./whatsapp-pdf-button";

/** Sends the sale's receipt (or invoice, when money is still owed) to WhatsApp as a PDF. */
export function ReceiptShareButton({ sale, store, payTo = [], label, className = "" }: { sale: Sale; store: StoreHead; payTo?: string[]; label?: string; className?: string }) {
  const invoice = sale.status !== "void" && sale.balance_due > 0;
  const text = `${invoice ? "Invoice" : "Receipt"} ${sale.number} from ${store?.name ?? "us"}. Total ${formatKobo(sale.total + (sale.deposit_total ?? 0))}${invoice ? `, balance ${formatKobo(sale.balance_due)}` : ""}.`;
  return (
    <WhatsAppPdfButton className={className} label={label ?? (invoice ? "Send invoice (PDF)" : "Send receipt (PDF)")} phone={sale.customer?.phone} who={sale.customer?.name ?? "the customer"}
      text={text} cacheKey={`${sale.id}-${sale.status}-${sale.balance_due}-${(sale.payments ?? []).length}-${payTo.join("|")}-${store?.logo_url ?? ""}-${store?.name ?? ""}`}
      make={() => saleReceiptFile(sale, store, payTo)} />
  );
}
