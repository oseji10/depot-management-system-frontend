"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CustomerModal } from "../../../../components/customer-form";
import { Badge, Button, Card, ICON, PageHeader, Stat, Svg, TableCard, TableEmpty, TableLoading, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDateTime, formatKobo } from "../../../../lib/format";
import { PAYMENT_LABEL, PAYMENT_TONE } from "../../../../lib/status";
import type { Customer, Paginated, Sale } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function CustomerDetailPage() {
  const id = useIdParam();
  const s = useSession();
  const [editing, setEditing] = useState(false);

  const doc = useQuery({ queryKey: ["customer", id], queryFn: () => api<Customer>(`/customers/${id}`) });
  const sales = useQuery({ queryKey: ["list", "/sales", "customer", id], queryFn: () => api<Paginated<Sale>>(`/sales?customer_id=${id}&per_page=50`) });

  const c = doc.data;
  if (!c) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const owing = c.outstanding ?? 0;
  const room = Math.max(c.credit_limit - owing, 0);
  const open = sales.data?.data.filter((x) => x.status === "completed" && x.balance_due > 0) ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        crumb={<Link href="/customers" className="hover:underline">← All customers</Link>}
        title={c.name}
        description={[c.type === "wholesale" ? "Wholesale" : "Retail", c.phone, c.email].filter(Boolean).join(" · ")}
        action={s.can("customers.manage") && <Button variant="secondary" onClick={() => setEditing(true)}><Svg d={ICON.edit} /> Edit</Button>}
      />

      {!c.is_active && <div className="mb-4"><Badge tone="bad">Inactive</Badge></div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Owes now" value={formatKobo(owing)} icon={ICON.alert} tone={owing > 0 ? "amber" : "green"} note={`${open.length} unpaid order${open.length === 1 ? "" : "s"}`} />
        <Stat label="Credit limit" value={c.credit_limit ? formatKobo(c.credit_limit) : "Cash only"} icon={ICON.cash} tone="blue" />
        <Stat label="Credit left" value={c.credit_limit ? formatKobo(room) : "–"} icon={ICON.check} />
        <Stat label="Orders" value={sales.data?.total ?? "…"} icon={ICON.cart} />
      </div>

      {(c.address || c.notes) && (
        <Card title="Details" className="mb-5">
          <dl className="space-y-1.5 text-sm">
            {c.address && <div className="flex gap-3"><dt className="w-20 shrink-0 text-ink-soft">Address</dt><dd>{c.address}</dd></div>}
            {c.notes && <div className="flex gap-3"><dt className="w-20 shrink-0 text-ink-soft">Notes</dt><dd>{c.notes}</dd></div>}
          </dl>
        </Card>
      )}

      {open.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Unpaid orders</h2>
          <div className="mb-6 space-y-2">
            {open.map((o) => (
              <Link key={o.id} href={`/sales/view?id=${o.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-3.5 transition hover:border-amber-300 hover:bg-amber-50">
                <span><span className="font-mono text-xs font-bold text-[#f40009]">{o.number}</span><span className="block text-xs text-ink-soft">{formatDateTime(o.sold_at)}</span></span>
                <span className="text-right"><span className="block font-bold text-amber-800">{formatKobo(o.balance_due)}</span><span className="text-xs text-ink-soft">of {formatKobo(o.total)}</span></span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Order history</h2>
      <TableCard min="34rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Sale</th>
            <th scope="col" className={`${thClass} text-right`}>Total</th>
            <th scope="col" className={thClass}>Payment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sales.isLoading && <TableLoading cols={3} rows={3} />}
          {sales.data?.data.length === 0 && <TableEmpty cols={3} title="No orders yet" icon={ICON.cart} />}
          {sales.data?.data.map((r) => (
            <tr key={r.id} className={r.status === "void" ? "opacity-60" : ""}>
              <td className="px-5 py-3.5"><Link href={`/sales/view?id=${r.id}`} className="font-mono text-xs font-bold text-[#f40009] hover:underline">{r.number}</Link><span className="block text-xs text-ink-soft">{formatDateTime(r.sold_at)}</span></td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(r.total)}</td>
              <td className="px-4 py-3.5">{r.status === "void" ? <Badge tone="bad">Void</Badge> : <Badge tone={PAYMENT_TONE[r.payment_status]}>{PAYMENT_LABEL[r.payment_status]}</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {editing && <CustomerModal customer={c} onClose={() => setEditing(false)} />}
    </div>
  );
}

export default withSuspense(CustomerDetailPage);
