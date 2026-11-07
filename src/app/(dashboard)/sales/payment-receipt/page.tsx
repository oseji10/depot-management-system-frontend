"use client";

import { useQuery } from "@tanstack/react-query";
import { PrintSheet } from "../../../../components/print-sheet";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { api } from "../../../../lib/api";
import { formatDateTime, formatKobo } from "../../../../lib/format";
import { METHOD_PAY_LABEL } from "../../../../lib/status";
import type { Sale } from "../../../../lib/types";

/** ?id=<sale>&payment=<payment id>: proof that a customer paid, with what is still owed afterwards. */
function PaymentReceipt() {
  const id = useIdParam();
  const paymentId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("payment") ?? "";
  const q = useQuery({ queryKey: ["sale", id], queryFn: () => api<Sale>(`/sales/${id}`) });
  const s = q.data;
  const live = (s?.payments ?? []).filter((p) => !p.voided_at).sort((a, b) => a.paid_at.localeCompare(b.paid_at) || a.id - b.id);
  const p = live.find((x) => String(x.id) === paymentId);
  const paidSoFar = p ? live.slice(0, live.indexOf(p) + 1).reduce((a, x) => a + x.amount, 0) : 0;
  const owedAfter = s ? Math.max(s.total + (s.deposit_total ?? 0) - (s.returned_total ?? 0) - paidSoFar, 0) : 0;

  return (
    <PrintSheet back={{ href: `/sales/view?id=${id}`, label: "Back to sale" }} title="Payment receipt" subtitle={p && formatDateTime(p.paid_at)}>
      {!s ? <p className="text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p> : !p ? <p className="text-ink-soft">That payment was not found, or it has been reversed.</p> : (
        <>
          <p className="text-base">Received from <b>{s.customer?.name ?? "Walk-in customer"}</b></p>
          <p className="my-4 text-3xl font-bold">{formatKobo(p.amount)}</p>
          <dl className="max-w-sm space-y-1">
            <div className="flex justify-between"><dt className="text-ink-soft">Paid by</dt><dd>{METHOD_PAY_LABEL[p.method]}{p.terminal ? ` (${p.terminal.name})` : ""}</dd></div>
            {p.reference && <div className="flex justify-between"><dt className="text-ink-soft">Reference</dt><dd>{p.reference}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-soft">For sale</dt><dd className="font-mono">{s.number}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Received by</dt><dd>{p.receiver?.name}</dd></div>
            <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Still owed on this sale</dt><dd>{formatKobo(owedAfter)}</dd></div>
          </dl>
          <p className="mt-8 text-xs text-ink-soft">Thank you.</p>
        </>
      )}
    </PrintSheet>
  );
}

export default withSuspense(PaymentReceipt);
