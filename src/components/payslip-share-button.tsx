"use client";

import { useState } from "react";
import { downloadBlob } from "../lib/pdf";
import { formatKobo } from "../lib/format";
import { monthLabel } from "../lib/payroll";
import { payslipFile } from "../lib/payslip-pdf";
import type { StoreHead } from "../lib/receipt-pdf";
import { whatsappLink } from "../lib/share";
import type { PayrollRun, Payslip } from "../lib/types";

const ICON = "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z";

/**
 * Sends one staff member's payslip as a PDF, like receipts. On a phone the share sheet opens with the PDF attached (pick WhatsApp, then the
 * staff member). On a computer the PDF is saved and WhatsApp opens on the staff member's number: attach the saved PDF there.
 */
export function PayslipShareButton({ slip, run, store, label, size = "md" }: {
  slip: Payslip; run: Pick<PayrollRun, "number" | "period" | "paid_at" | "pay_method">; store: StoreHead; label?: string; size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const first = slip.employee.name.split(" ")[0];
  const text = `Hello ${first}, your payslip for ${monthLabel(run.period)} from ${store?.name ?? "us"} is attached. Net pay ${formatKobo(slip.net)}.`;

  const send = async () => {
    setBusy(true); setNote(null);
    try {
      const file = await payslipFile(slip, run, store);
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: file.name, text }); return; }
        catch (e) { if ((e as Error).name === "AbortError") return; }
      }
      downloadBlob(file.name, file);
      window.open(whatsappLink(slip.employee.phone, text), "_blank", "noopener,noreferrer");
      setNote(`The PDF (${file.name}) was saved to this device. In WhatsApp, tap the paperclip and attach it.`);
    } catch (e) { setNote((e as Error).message || "The PDF could not be made."); }
    finally { setBusy(false); }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={send} disabled={busy}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366]/40 bg-[#25d366]/10 font-semibold text-[#128c4a] transition hover:bg-[#25d366]/20 disabled:opacity-60 ${size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm"}`}>
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d={ICON} /></svg>
        {busy ? "Making PDF…" : label ?? `Send to ${first} (PDF)`}
      </button>
      {note && <span role="status" className="max-w-xs text-xs text-ink-soft">{note}</span>}
    </span>
  );
}

/** Saves the payslip PDF to this device (for printing or keeping). */
export function PayslipDownloadButton({ slip, run, store }: { slip: Payslip; run: Pick<PayrollRun, "number" | "period" | "paid_at" | "pay_method">; store: StoreHead }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { const f = await payslipFile(slip, run, store); downloadBlob(f.name, f); } finally { setBusy(false); } }}
      className="inline-flex min-h-9 items-center rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-[#ff3b3f]/40 disabled:opacity-60">
      {busy ? "Making PDF…" : "Download PDF"}
    </button>
  );
}
