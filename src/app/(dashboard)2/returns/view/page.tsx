"use client";

import { useQuery } from "@tanstack/react-query";
import { PrintSheet } from "../../../../components/print-sheet";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { api } from "../../../../lib/api";
import { formatAmount, formatDateTime, formatKobo } from "../../../../lib/format";
import type { SaleReturnDoc } from "../../../../lib/types";

function CreditNotePage() {
  const id = useIdParam();
  const q = useQuery({ queryKey: ["return", id], queryFn: () => api<SaleReturnDoc>(`/returns/${id}`) });
  const r = q.data;

  return (
    <PrintSheet back={{ href: r?.sale ? `/sales/view?id=${r.sale.id}` : "/returns", label: "Back" }} title="Credit note" subtitle={r && <><span className="font-mono font-semibold">{r.number}</span><br />{formatDateTime(r.returned_at)}</>}>
      {!r ? <p className="text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
            <div><p className="text-ink-soft">Customer</p><p className="text-sm font-semibold">{r.customer?.name ?? "Walk-in customer"}</p></div>
            <div className="text-right"><p className="text-ink-soft">Against sale</p><p className="text-sm font-semibold">{r.sale?.number}</p></div>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-line text-left text-xs text-ink-soft"><th className="py-2">Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-line">
              {r.lines?.map((l) => <tr key={l.id}><td className="py-2">{l.product?.name}<span className="block text-xs text-ink-soft">{l.unit?.name}</span></td><td className="text-right">{l.quantity}</td><td className="text-right">{formatAmount(l.unit_price)}</td><td className="text-right">{formatAmount(l.line_total)}</td></tr>)}
            </tbody>
          </table>
          <dl className="mt-4 ml-auto w-64 space-y-1">
            <div className="flex justify-between text-base font-bold"><dt>Credit value</dt><dd>{formatKobo(r.total)}</dd></div>
            {r.applied_to_balance > 0 && <div className="flex justify-between"><dt>Taken off what they owe</dt><dd>{formatKobo(r.applied_to_balance)}</dd></div>}
            {r.refunded > 0 && <div className="flex justify-between"><dt>Paid back ({r.refund_method})</dt><dd>{formatKobo(r.refunded)}</dd></div>}
          </dl>
          <p className="mt-6 text-xs text-ink-soft">Reason: {r.reason}. Prepared by {r.creator?.name}.</p>
          <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-ink-soft"><p className="border-t border-line pt-1">Issued by</p><p className="border-t border-line pt-1">Customer signature</p></div>
        </>
      )}
    </PrintSheet>
  );
}

export default withSuspense(CreditNotePage);
