"use client";

import { useQuery } from "@tanstack/react-query";
import { PrintSheet } from "../../../../components/print-sheet";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { api } from "../../../../lib/api";
import { formatDateTime, formatKobo } from "../../../../lib/format";
import { METHOD_PAY_LABEL } from "../../../../lib/status";
import type { Sale } from "../../../../lib/types";

/** Slip a customer signs when money is handed back after a sale was voided. */
function RefundSlip() {
  const id = useIdParam();
  const q = useQuery({ queryKey: ["sale", id], queryFn: () => api<Sale>(`/sales/${id}`) });
  const s = q.data;
  const byMethod = Object.entries((s?.payments ?? []).reduce<Record<string, number>>((a, p) => ({ ...a, [p.method]: (a[p.method] ?? 0) + p.amount }), {}));
  const total = byMethod.reduce((a, [, v]) => a + v, 0);

  return (
    <PrintSheet back={{ href: `/sales/view?id=${id}`, label: "Back to sale" }} title="Refund slip" subtitle={s && <><span className="font-mono font-semibold">{s.number}</span><br />Voided {s.voided_at ? formatDateTime(s.voided_at) : ""}</>}>
      {!s ? <p className="text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p> : (
        <>
          <p className="mb-4">Customer: <b>{s.customer?.name ?? "Walk-in customer"}</b></p>
          <table className="w-full"><tbody className="divide-y divide-line">{byMethod.map(([m, v]) => <tr key={m}><td className="py-2">{METHOD_PAY_LABEL[m as keyof typeof METHOD_PAY_LABEL]}</td><td className="text-right">{formatKobo(v)}</td></tr>)}</tbody></table>
          <p className="mt-4 text-right text-base font-bold">Total refunded: {formatKobo(total)}</p>
          <p className="mt-4 text-xs text-ink-soft">Reason: {s.void_reason}</p>
          <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-ink-soft"><p className="border-t border-line pt-1">Paid out by</p><p className="border-t border-line pt-1">Customer signature</p></div>
        </>
      )}
    </PrintSheet>
  );
}

export default withSuspense(RefundSlip);
