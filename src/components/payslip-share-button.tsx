"use client";

import { useState } from "react";
import { downloadBlob } from "../lib/pdf";
import { formatKobo } from "../lib/format";
import { monthLabel } from "../lib/payroll";
import { payslipFile } from "../lib/payslip-pdf";
import type { StoreHead } from "../lib/receipt-pdf";
import type { PayrollRun, Payslip } from "../lib/types";
import { WhatsAppPdfButton } from "./whatsapp-pdf-button";

type Run = Pick<PayrollRun, "number" | "period" | "paid_at" | "pay_method">;

/** Sends one staff member's payslip to WhatsApp as a PDF. */
export function PayslipShareButton({ slip, run, store, label, size = "md" }: { slip: Payslip; run: Run; store: StoreHead; label?: string; size?: "sm" | "md" }) {
  const first = slip.employee.name.split(" ")[0];
  return (
    <WhatsAppPdfButton size={size} label={label ?? `Send to ${first} (PDF)`} phone={slip.employee.phone} who={slip.employee.name}
      text={`Hello ${first}, here is your payslip for ${monthLabel(run.period)} from ${store?.name ?? "us"}. Net pay ${formatKobo(slip.net)}.`}
      cacheKey={`${slip.id}-${slip.net}-${slip.lines.length}-${run.paid_at ?? ""}-${store?.logo_url ?? ""}`} make={() => payslipFile(slip, run, store)} />
  );
}

/** Saves the payslip PDF to this device (for printing or keeping). */
export function PayslipDownloadButton({ slip, run, store }: { slip: Payslip; run: Run; store: StoreHead }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { const f = await payslipFile(slip, run, store); downloadBlob(f.name, f); } finally { setBusy(false); } }}
      className="inline-flex min-h-9 items-center rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-[#ff3b3f]/40 disabled:opacity-60">
      {busy ? "Making PDF…" : "Download PDF"}
    </button>
  );
}
