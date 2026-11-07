"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button, PageHeader, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import type { Discrepancy, Paginated } from "../../../lib/types";

export default function DiscrepanciesPage() {
  const suppliers = useOptions("/suppliers");
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/goods-receipts/discrepancies", page, supplierId, from, to],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      Object.entries({ supplier_id: supplierId, from, to }).forEach(([k, v]) => v && q.set(k, v));
      return api<Paginated<Discrepancy>>(`/goods-receipts/discrepancies?${q}`);
    },
  });

  const th = "px-4 py-2.5 font-medium";
  const control = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm";
  const reset = (set: (v: string) => void) => (v: string) => { set(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Supplier discrepancies"
        description="Goods that arrived damaged or were rejected on posted receipts. Use this to claim credit or replacements."
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="sr-only" htmlFor="d-supplier">Supplier</label>
        <select id="d-supplier" value={supplierId} onChange={(e) => reset(setSupplierId)(e.target.value)} className={control}>
          <option value="">All suppliers</option>
          {suppliers.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <label className="text-xs text-ink-soft">From<input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={`${control} mt-0.5 block`} /></label>
        <label className="text-xs text-ink-soft">To<input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className={`${control} mt-0.5 block`} /></label>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Received</th>
              <th scope="col" className={th}>Receipt</th>
              <th scope="col" className={th}>Supplier</th>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={`${th} text-right`}>Damaged</th>
              <th scope="col" className={`${th} text-right`}>Rejected</th>
              <th scope="col" className={th}>What went wrong</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={7} />}
            {error && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-soft">No damaged or rejected goods recorded.</td></tr>}
            {data?.data.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap px-4 py-3">{formatDate(d.receipt.received_on)}</td>
                <td className="px-4 py-3"><Link href={`/goods-receipts/view?id=${d.receipt.id}`} className="font-semibold text-[#f40009] hover:underline">{d.receipt.number}</Link>{d.receipt.supplier_reference && <p className="text-xs text-ink-soft">{d.receipt.supplier_reference}</p>}</td>
                <td className="px-4 py-3">{d.receipt.supplier?.name}</td>
                <td className="px-4 py-3"><p className="font-medium">{d.product?.name}</p><p className="text-xs text-ink-soft">{d.unit?.name.toLowerCase()}s</p></td>
                <td className="px-4 py-3 text-right">{d.damaged || <span className="text-ink-soft">–</span>}</td>
                <td className="px-4 py-3 text-right">{d.rejected || <span className="text-ink-soft">–</span>}</td>
                <td className="px-4 py-3">{d.reason ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
          <span>Page {data.current_page} of {data.last_page}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
