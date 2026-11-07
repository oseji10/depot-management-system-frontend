"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PrintSheet } from "../../../../components/print-sheet";
import { Field } from "../../../../components/ui";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { api } from "../../../../lib/api";
import { formatAmount, formatDate, formatDateTime, formatKobo } from "../../../../lib/format";
import type { Statement } from "../../../../lib/types";

const TYPE: Record<string, string> = { sale: "Sale", payment: "Payment", credit_note: "Credit note", refund: "Refund" };

function StatementPage() {
  const id = useIdParam();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useQuery({ queryKey: ["statement", id, from, to], queryFn: () => api<Statement>(`/customers/${id}/statement?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`) });
  const d = q.data;

  return (
    <PrintSheet back={{ href: `/customers/view?id=${id}`, label: "Back to customer" }} title="Statement of account" subtitle={<>{d?.from ? formatDate(d.from) : "Start"} to {d?.to ? formatDate(d.to) : "today"}</>}
      actions={<><Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Field label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}>
      {!d ? <p className="text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p> : (
        <>
          <div className="mb-4">
            <p className="font-semibold">{d.customer.name}</p>
            {d.customer.phone && <p className="text-xs text-ink-soft">{d.customer.phone}</p>}
            {d.customer.address && <p className="text-xs text-ink-soft">{d.customer.address}</p>}
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-line text-left text-xs text-ink-soft"><th className="py-2">Date</th><th>Details</th><th className="text-right">Charges</th><th className="text-right">Credits</th><th className="text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.from && <tr><td className="py-2" colSpan={4}>Balance brought forward</td><td className="text-right font-medium">{formatAmount(d.opening)}</td></tr>}
              {d.rows.map((r, i) => (
                <tr key={i}><td className="py-2 whitespace-nowrap">{formatDateTime(r.at)}</td><td>{TYPE[r.type]} {r.ref}<span className="block text-xs text-ink-soft">{r.note}</span></td>
                  <td className="text-right">{r.debit ? formatAmount(r.debit) : ""}</td><td className="text-right">{r.credit ? formatAmount(r.credit) : ""}</td><td className="text-right font-medium">{formatAmount(r.balance)}</td></tr>
              ))}
              {d.rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-soft">Nothing in this period.</td></tr>}
            </tbody>
            <tfoot><tr className="border-t-2 border-line font-bold"><td colSpan={2} className="py-2">Totals</td><td className="text-right">{formatAmount(d.total_debit)}</td><td className="text-right">{formatAmount(d.total_credit)}</td><td className="text-right">{formatAmount(d.closing)}</td></tr></tfoot>
          </table>
          <p className="mt-4 text-right text-base font-bold">{d.closing > 0 ? `Amount due: ${formatKobo(d.closing)}` : d.closing < 0 ? `Credit in your favour: ${formatKobo(-d.closing)}` : "Nothing owing"}</p>
        </>
      )}
    </PrintSheet>
  );
}

export default withSuspense(StatementPage);
