"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, ICON, PageHeader, SelectField, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import type { ReorderSuggestion } from "../../../../lib/types";

export default function ReorderPage() {
  const s = useSession();
  const [cover, setCover] = useState("14");
  const q = useQuery({ queryKey: ["reorder", cover], queryFn: () => api<{ data: ReorderSuggestion[] }>(`/stock/reorder-suggestions?cover=${cover}`) });

  return (
    <div>
      <PageHeader title="What to reorder" description="Products under their reorder level, or selling fast enough to run out within a week. Set levels on the Stock page."
        action={s.can("purchasing.manage") ? <Link href="/purchase-orders" className="text-sm font-semibold text-[#f40009] hover:underline">Go to purchase orders →</Link> : undefined} />
      <Toolbar>
        <SelectField label="Order enough to last" value={cover} onChange={setCover} options={[{ value: "7", label: "A week of selling" }, { value: "14", label: "Two weeks of selling" }, { value: "30", label: "A month of selling" }]} />
      </Toolbar>
      <TableCard min="52rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Product</th><th scope="col" className={`${thClass} text-right`}>In stock</th><th scope="col" className={`${thClass} text-right`}>Reorder at</th>
            <th scope="col" className={`${thClass} text-right`}>Sells a day</th><th scope="col" className={`${thClass} text-right`}>Lasts</th><th scope="col" className={`${thClass} text-right`}>Suggested order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={6} />}
          {q.error && <TableError cols={6} message={(q.error as Error).message} />}
          {q.data && q.data.data.length === 0 && <TableEmpty cols={6} title="Nothing to reorder" hint="Everything with a reorder level is comfortably stocked." icon={ICON.box} />}
          {q.data?.data.map((r) => (
            <tr key={`${r.warehouse.id}-${r.product.id}`}>
              <td className="px-5 py-3.5"><span className="font-semibold">{r.product.name}</span><span className="block text-xs text-ink-soft">{r.warehouse.name}</span></td>
              <td className="px-4 py-3.5 text-right">{r.saleable}{r.below_level && <span className="ml-2"><Badge tone="bad">Low</Badge></span>}</td>
              <td className="px-4 py-3.5 text-right">{r.min_quantity}</td>
              <td className="px-4 py-3.5 text-right">{r.daily || "–"}</td>
              <td className="px-4 py-3.5 text-right">{r.days_left == null ? "–" : `${r.days_left} days`}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{r.suggested_packs != null ? `${r.suggested_packs} ${r.pack?.name}` : r.suggested}<span className="block text-xs font-normal text-ink-soft">{r.suggested} units</span></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
