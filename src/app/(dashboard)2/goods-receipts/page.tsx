"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge, Button, PageHeader, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { GRN_LABEL, GRN_TONE } from "../../../lib/status";
import type { GoodsReceipt, Paginated } from "../../../lib/types";

export default function GoodsReceiptsPage() {
  const s = useSession();
  const suppliers = useOptions("/suppliers");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/goods-receipts", page, status, supplierId, deferred],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (status) q.set("status", status);
      if (supplierId) q.set("supplier_id", supplierId);
      if (deferred) q.set("search", deferred);
      return api<Paginated<GoodsReceipt>>(`/goods-receipts?${q}`);
    },
  });

  const th = "px-4 py-2.5 font-medium";
  const control = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm";

  return (
    <>
      <PageHeader
        title="Goods receipts"
        description="Deliveries counted in at the warehouse. Stock, cost and rebate eligibility only start when a receipt is posted."
        action={s.can("goods-receipts.record") && (
          <Link href="/goods-receipts/new" className="inline-flex min-h-11 items-center rounded-xl bg-[#f40009] px-4 text-sm font-semibold text-white hover:bg-[#a50006]">Record a delivery</Link>
        )}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="gr-search">Search</label>
        <input id="gr-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Receipt or delivery note number" className={`${control} min-w-60`} />
        <label className="sr-only" htmlFor="gr-supplier">Supplier</label>
        <select id="gr-supplier" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPage(1); }} className={control}>
          <option value="">All suppliers</option>
          {suppliers.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="gr-status">Status</label>
        <select id="gr-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={control}>
          <option value="">All statuses</option>
          {Object.entries(GRN_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[50rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Receipt</th>
              <th scope="col" className={th}>Supplier</th>
              <th scope="col" className={th}>Delivery note</th>
              <th scope="col" className={th}>Warehouse</th>
              <th scope="col" className={th}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={6} />}
            {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">No receipts found.</td></tr>}
            {data?.data.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-3 font-medium">{g.number}<p className="text-xs font-normal text-ink-soft">{formatDate(g.received_on)}{g.purchase_order ? ` · ${g.purchase_order.number}` : ""}</p></td>
                <td className="px-4 py-3">{g.supplier?.name}</td>
                <td className="px-4 py-3">{g.supplier_reference ?? "–"}</td>
                <td className="px-4 py-3">{g.warehouse?.name}</td>
                <td className="px-4 py-3"><Badge tone={GRN_TONE[g.status]}>{GRN_LABEL[g.status]}</Badge></td>
                <td className="px-4 py-3 text-right"><Link href={`/goods-receipts/view?id=${g.id}`} className="font-semibold text-[#f40009] hover:underline">Open</Link></td>
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
    </>
  );
}
