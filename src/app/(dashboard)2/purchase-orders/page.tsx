"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { PurchaseOrderForm } from "../../../components/purchase-order-form";
import { Badge, Button, PageHeader, TableLoading } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { PO_LABEL, PO_TONE } from "../../../lib/status";
import type { Paginated, PurchaseOrder } from "../../../lib/types";

export default function PurchaseOrdersPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/purchase-orders", page, status, deferred],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (status) q.set("status", status);
      if (deferred) q.set("search", deferred);
      return api<Paginated<PurchaseOrder>>(`/purchase-orders?${q}`);
    },
  });

  const th = "px-4 py-2.5 font-medium";
  const control = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm";

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="What you have asked suppliers to deliver. An order does not add stock: only a posted goods receipt does."
        action={s.can("purchasing.manage") && <Button onClick={() => setCreating(true)}>New purchase order</Button>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="po-search">Search</label>
        <input id="po-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Order number" className={`${control} min-w-48`} />
        <label className="sr-only" htmlFor="po-status">Status</label>
        <select id="po-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={control}>
          <option value="">All statuses</option>
          {Object.entries(PO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Number</th>
              <th scope="col" className={th}>Supplier</th>
              <th scope="col" className={th}>Deliver to</th>
              <th scope="col" className={th}>Expected</th>
              <th scope="col" className={th}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={6} />}
            {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">No purchase orders yet.</td></tr>}
            {data?.data.map((po) => (
              <tr key={po.id}>
                <td className="px-4 py-3 font-medium">{po.number}<p className="text-xs font-normal text-ink-soft">{formatDate(po.order_date)} · {po.lines_count} line{po.lines_count === 1 ? "" : "s"}</p></td>
                <td className="px-4 py-3">{po.supplier?.name}</td>
                <td className="px-4 py-3">{po.warehouse?.name}</td>
                <td className="px-4 py-3">{po.expected_date ? formatDate(po.expected_date) : "–"}</td>
                <td className="px-4 py-3"><Badge tone={PO_TONE[po.status]}>{PO_LABEL[po.status]}</Badge></td>
                <td className="px-4 py-3 text-right"><Link href={`/purchase-orders/view?id=${po.id}`} className="font-semibold text-[#f40009] hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
          <span>Page {data.current_page} of {data.last_page} · {data.total} total</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {creating && <PurchaseOrderForm onClose={() => setCreating(false)} />}
    </>
  );
}
