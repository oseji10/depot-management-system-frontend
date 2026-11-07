"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, Chips, PageHeader, Pager, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../../components/ui";
import { api } from "../../../../lib/api";
import { formatDateTime, formatKobo } from "../../../../lib/format";
import type { Paginated, TripRow } from "../../../../lib/types";

type Filter = "all" | "open" | "closed";

export default function TripsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery({
    queryKey: ["trips", page, filter],
    queryFn: () => api<Paginated<TripRow>>(`/trips?page=${page}${filter === "all" ? "" : `&status=${filter}`}`),
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader title="Trips" description="Every time stock went out on a van: what was loaded, what was sold and how it ended." />

      <div className="mb-4">
        <Chips label="Status" value={filter} onChange={(v) => { setFilter(v); setPage(1); }}
          options={[{ value: "all", label: "All trips" }, { value: "open", label: "On the road" }, { value: "closed", label: "Checked in" }]} />
      </div>

      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Trip</th>
            <th scope="col" className={thClass}>Salesperson</th>
            <th scope="col" className={thClass}>Status</th>
            <th scope="col" className={`${thClass} text-right`}>Loaded</th>
            <th scope="col" className={`${thClass} text-right`}>Sales</th>
            <th scope="col" className={`${thClass} text-right`}>Cash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading ? <TableLoading cols={6} /> : list.error ? <TableError cols={6} message={(list.error as Error).message} /> : list.data?.data.length === 0 ? (
            <TableEmpty cols={6} title="No trips yet" hint="A trip starts the first time stock is issued to a salesperson." />
          ) : list.data?.data.map((t) => (
            <tr key={t.id} className="transition hover:bg-[#fff5f5]">
              <td className="px-5 py-3.5"><Link href={`/field/trips/view?id=${t.id}`} className="font-semibold text-[#f40009] hover:underline">{t.number}</Link><p className="text-xs text-ink-soft">{formatDateTime(t.opened_at)}</p></td>
              <td className="px-4 py-3.5">{t.rep?.name ?? "—"}</td>
              <td className="px-4 py-3.5">{t.status === "open" ? <Badge tone="good">On the road</Badge> : <Badge tone="neutral">Checked in</Badge>}</td>
              <td className="px-4 py-3.5 text-right tabular-nums">{t.issued_units.toLocaleString("en-NG")} units</td>
              <td className="px-4 py-3.5 text-right"><p className="font-semibold tabular-nums">{formatKobo(t.sales_total)}</p><p className="text-xs text-ink-soft">{t.orders} order{t.orders === 1 ? "" : "s"}</p></td>
              <td className="px-4 py-3.5 text-right">
                {t.cash_variance === null ? <span className="text-ink-soft">—</span> : t.cash_variance === 0 ? <Badge tone="good">Balanced</Badge> : <Badge tone={t.cash_variance < 0 ? "bad" : "warn"}>{t.cash_variance < 0 ? "Short" : "Over"} {formatKobo(Math.abs(t.cash_variance))}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.data.length} setPage={setPage} />}
    </>
  );
}
