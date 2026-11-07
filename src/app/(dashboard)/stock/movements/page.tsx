"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Badge, Button, PageHeader, TableLoading } from "../../../../components/ui";
import { useOptions } from "../../../../hooks/options";
import { api } from "../../../../lib/api";
import { formatDateTime } from "../../../../lib/format";
import type { Movement, Paginated } from "../../../../lib/types";
import { MOVEMENT_LABEL, STATUS_LABEL } from "../../../../lib/units";

const selectClass = "min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm transition hover:border-[#ff3b3f]/40 focus:border-[#ff3b3f] focus:outline-none focus:ring-4 focus:ring-[#ff3b3f]/15";

export default function StockLedgerPage() {
  const warehouses = useOptions("/warehouses");
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/stock/movements", page, deferred, warehouseId, type, status, from, to],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      Object.entries({ search: deferred, warehouse_id: warehouseId, movement_type: type, status, from, to }).forEach(([k, v]) => v && q.set(k, v));
      return api<Paginated<Movement>>(`/stock/movements?${q}`);
    },
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const th = "px-4 py-2.5 font-medium";

  return (
    <>
      <PageHeader
        title="Stock ledger"
        description="Every stock movement ever recorded, newest first. Entries are permanent: mistakes are fixed with a new entry, never an edit."
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="sr-only" htmlFor="ml-search">Search</label>
        <input id="ml-search" type="search" value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Product or document number" className={`${selectClass} min-w-56`} />
        <label className="sr-only" htmlFor="ml-wh">Warehouse</label>
        <select id="ml-wh" value={warehouseId} onChange={(e) => reset(setWarehouseId)(e.target.value)} className={selectClass}>
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="ml-type">Type</label>
        <select id="ml-type" value={type} onChange={(e) => reset(setType)(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          {Object.entries(MOVEMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="sr-only" htmlFor="ml-status">Status</label>
        <select id="ml-status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={selectClass}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="text-xs text-ink-soft">From<input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={`${selectClass} mt-0.5 block`} /></label>
        <label className="text-xs text-ink-soft">To<input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className={`${selectClass} mt-0.5 block`} /></label>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>When</th>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={th}>Warehouse</th>
              <th scope="col" className={th}>Type</th>
              <th scope="col" className={`${th} text-right`}>Quantity</th>
              <th scope="col" className={th}>Reference</th>
              <th scope="col" className={th}>By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={7} />}
            {error && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-soft">No movements match these filters.</td></tr>}
            {data?.data.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(m.occurred_at)}</td>
                <td className="px-4 py-3"><p className="font-medium">{m.product?.name}</p><p className="text-xs text-ink-soft">{m.product?.sku}</p></td>
                <td className="px-4 py-3">{m.warehouse?.name}</td>
                <td className="px-4 py-3">
                  {MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}{" "}
                  {m.status !== "saleable" && <Badge tone="warn">{STATUS_LABEL[m.status]}</Badge>}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${m.quantity < 0 ? "text-[#c23a3a]" : "text-[#f40009]"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td className="px-4 py-3">{m.reference ?? "–"}</td>
                <td className="px-4 py-3">{m.user?.name ?? "System"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
          <span>Page {data.current_page} of {data.last_page} · {data.total} entries</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
