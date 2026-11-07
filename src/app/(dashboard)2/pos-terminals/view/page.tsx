"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, PageHeader, Pager, Stat, ICON, TableCard, TableEmpty, TableError, TableLoading, filterClass, theadClass, thClass } from "../../../../components/ui";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { api } from "../../../../lib/api";
import { formatDate, formatDateTime, formatKobo } from "../../../../lib/format";
import type { TerminalTransactions } from "../../../../lib/types";

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA"); };
const today = () => new Date().toLocaleDateString("en-CA");

function TerminalPage() {
  const id = useIdParam();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["terminals", "transactions", id, from, to, page], enabled: !!id,
    queryFn: () => api<TerminalTransactions>(`/pos-terminals/${id}/transactions?from=${from}&to=${to}&page=${page}`),
  });
  const t = q.data?.terminal;

  return (
    <>
      <Link href="/pos-terminals" className="mb-2 inline-block text-sm text-ink-soft hover:underline">← Card terminals</Link>
      <PageHeader
        title={t?.name ?? "Card terminal"}
        description={t ? [t.provider, t.terminal_id && `TID ${t.terminal_id}`, t.branch?.name].filter(Boolean).join(" · ") : undefined}
        action={t && !t.is_active && <Badge tone="warn">Not in use</Badge>}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink-soft">From<input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${filterClass} mt-1 block`} /></label>
        <label className="text-sm text-ink-soft">To<input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${filterClass} mt-1 block`} /></label>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <Stat label="Takings in this period" value={formatKobo(q.data?.total ?? 0)} icon={ICON.cart} />
        <Stat label="Card payments" value={q.data?.payments.total ?? 0} icon={ICON.box} tone="blue" />
      </div>

      {q.error && <p role="alert" className="mb-4 text-sm text-[#c23a3a]">{(q.error as Error).message}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold">Day by day</h2>
          <p className="mb-2 text-xs text-ink-soft">Tick each day off against the provider&apos;s settlement report.</p>
          <TableCard min="16rem">
            <thead className={theadClass}><tr><th className={thClass}>Day</th><th className={`${thClass} text-right`}>Payments</th><th className={`${thClass} text-right`}>Total</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.isLoading && <TableLoading cols={3} />}
              {q.data?.days.length === 0 && <TableEmpty cols={3} title="Nothing in this period" />}
              {q.data?.days.map((d) => (
                <tr key={d.day}><td className="px-4 py-2.5">{formatDate(d.day)}</td><td className="px-4 py-2.5 text-right">{d.payments}</td><td className="px-4 py-2.5 text-right font-semibold">{formatKobo(d.total)}</td></tr>
              ))}
            </tbody>
          </TableCard>
        </div>

        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold">Transactions</h2>
          <TableCard min="34rem">
            <thead className={theadClass}><tr><th className={thClass}>When</th><th className={thClass}>Sale</th><th className={thClass}>Slip / reference</th><th className={thClass}>Taken by</th><th className={`${thClass} text-right`}>Amount</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.isLoading && <TableLoading cols={5} />}
              {q.error && <TableError cols={5} message={(q.error as Error).message} />}
              {q.data?.payments.data.length === 0 && <TableEmpty cols={5} title="No card payments on this terminal" />}
              {q.data?.payments.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{formatDateTime(p.paid_at)}</td>
                  <td className="px-4 py-2.5"><Link href={`/sales/view?id=${p.sale.id}`} className="font-mono text-xs font-bold text-[#f40009] hover:underline">{p.sale.number}</Link>{p.sale.customer && <span className="ml-2 text-xs text-ink-soft">{p.sale.customer.name}</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.reference ?? "–"}</td>
                  <td className="px-4 py-2.5">{p.receiver?.name ?? "–"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatKobo(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          {q.data && <Pager page={page} last={q.data.payments.last_page} total={q.data.payments.total} current={q.data.payments.data.length} setPage={setPage} />}
        </div>
      </div>
    </>
  );
}

export default withSuspense(TerminalPage);
