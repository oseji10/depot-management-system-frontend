"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ICON, PageHeader, Pager, SearchBox, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass } from "../../../components/ui";
import { api } from "../../../lib/api";
import { formatDateTime, formatKobo } from "../../../lib/format";
import type { SaleReturnDoc } from "../../../lib/types";

type Page = { data: SaleReturnDoc[]; current_page: number; last_page: number; total: number };

export default function ReturnsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["list", "/returns", search, page], queryFn: () => api<Page>(`/returns?${new URLSearchParams({ page: String(page), ...(search ? { search } : {}) })}`) });
  const d = q.data;

  return (
    <div>
      <PageHeader title="Returns and credit notes" description="Goods customers brought back. Start one from the sale itself." />
      <Toolbar><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search credit note number" /></Toolbar>
      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Credit note</th><th scope="col" className={thClass}>Sale</th><th scope="col" className={thClass}>Customer</th>
            <th scope="col" className={`${thClass} text-right`}>Value</th><th scope="col" className={`${thClass} text-right`}>Cash back</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={5} />}
          {q.error && <TableError cols={5} message={(q.error as Error).message} />}
          {d && d.data.length === 0 && <TableEmpty cols={5} title="No returns yet" icon={ICON.doc} />}
          {d?.data.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-3.5"><Link href={`/returns/view?id=${r.id}`} className="font-semibold hover:underline">{r.number}</Link><span className="block text-xs text-ink-soft">{formatDateTime(r.returned_at)}</span></td>
              <td className="px-4 py-3.5">{r.sale && <Link href={`/sales/view?id=${r.sale.id}`} className="hover:underline">{r.sale.number}</Link>}</td>
              <td className="px-4 py-3.5">{r.customer?.name ?? "Walk-in"}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(r.total)}</td>
              <td className="px-4 py-3.5 text-right">{r.refunded ? formatKobo(r.refunded) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {d && <Pager page={page} last={d.last_page} total={d.total} current={d.data.length} setPage={setPage} />}
    </div>
  );
}
