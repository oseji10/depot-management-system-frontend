"use client";

import { useState } from "react";
import { saleReceiptFile, type StoreHead } from "../lib/receipt-pdf";
import { downloadBlob } from "../lib/pdf";
import { formatKobo } from "../lib/format";
import { whatsappLink } from "../lib/share";
import type { Sale } from "../lib/types";

const ICON = "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z";

/**
 * Sends the receipt as a PDF file. On a phone the share sheet opens with the PDF attached, so the person picks WhatsApp and the customer.
 * On a computer a link cannot carry a file, so the PDF is saved and WhatsApp opens with a short message: attach the saved PDF there.
 */
export function ReceiptShareButton({ sale, store, payTo = [], label, className = "" }: { sale: Sale; store: StoreHead; payTo?: string[]; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const invoice = sale.status !== "void" && sale.balance_due > 0;
  const text = `${invoice ? "Invoice" : "Receipt"} ${sale.number} from ${store?.name ?? "us"}. Total ${formatKobo(sale.total + (sale.deposit_total ?? 0))}${invoice ? `, balance ${formatKobo(sale.balance_due)}` : ""}. The PDF is attached.`;

  const send = async () => {
    setBusy(true); setNote(null);
    try {
      const file = await saleReceiptFile(sale, store, payTo);
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: file.name, text }); return; }
        catch (e) { if ((e as Error).name === "AbortError") return; }
      }
      downloadBlob(file.name, file);
      window.open(whatsappLink(sale.customer?.phone, text), "_blank", "noopener,noreferrer");
      setNote(`The PDF (${file.name}) was saved to this device. In WhatsApp, tap the paperclip and attach it.`);
    } catch (e) { setNote((e as Error).message || "The PDF could not be made."); }
    finally { setBusy(false); }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={send} disabled={busy}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#25d366]/40 bg-[#25d366]/10 px-4 text-sm font-semibold text-[#128c4a] transition hover:bg-[#25d366]/20 disabled:opacity-60 ${className}`}>
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d={ICON} /></svg>
        {busy ? "Making PDF…" : label ?? (invoice ? "Send invoice (PDF)" : "Send receipt (PDF)")}
      </button>
      {note && <span role="status" className="max-w-xs text-xs text-ink-soft">{note}</span>}
    </span>
  );
}
