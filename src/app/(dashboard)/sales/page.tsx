"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  Badge, Button, Chips, ICON, PageHeader, Pager, SearchBox, Stat, Svg, TableCard, TableEmpty, TableError, TableLoading, Toolbar, filterClass, theadClass, thClass,
} from "../../../components/ui";
import { ImportOrdersButton } from "../../../components/import-buttons";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDateTime, formatKobo } from "../../../lib/format";
import { PAYMENT_LABEL, PAYMENT_TONE } from "../../../lib/status";
import type { Paginated, Sale, SalesSummary } from "../../../lib/types";

type Filter = "all" | "paid" | "partial" | "unpaid" | "void";

export default function SalesPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = () => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  };

  const summary = useQuery({ queryKey: ["sales-summary", search, from, to], queryFn: () => api<SalesSummary>(`/sales/summary?${q()}`) });

  const list = useQuery({
    queryKey: ["list", "/sales", page, search, filter, from, to],
    queryFn: () => {
      const p = q();
      p.set("page", String(page));
      if (filter === "void") p.set("status", "void");
      else if (filter !== "all") p.set("payment_status", filter);
      return api<Paginated<Sale>>(`/sales?${p}`);
    },
  });

  const m = summary.data;
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale made at the counter, by phone or for delivery."
        action={<div className="flex gap-2">{s.can("sales.import") && <ImportOrdersButton />}{s.can("sales.create") && <Link href="/pos"><Button><Svg d={ICON.plus} /> New sale</Button></Link>}</div>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total sales" value={m ? formatKobo(m.sales) : "…"} icon={ICON.trend} note={m ? `${m.completed} completed order${m.completed === 1 ? "" : "s"}` : undefined} />
        <Stat label="Collected" value={m ? formatKobo(m.collected) : "…"} icon={ICON.cash} tone="blue" note={m && m.discounts > 0 ? `${formatKobo(m.discounts)} given as discount` : "Money received so far"} />
        <Stat label="Still owed" value={m ? formatKobo(m.outstanding) : "…"} icon={ICON.alert} tone={m && m.outstanding > 0 ? "amber" : "green"} note={m ? `${m.unpaid} unpaid order${m.unpaid === 1 ? "" : "s"}` : undefined} />
        <Stat label="Voided" value={m?.voided ?? "…"} icon={ICON.x} tone="rose" note="Cancelled sales stay on record" />
      </div>

      <Toolbar>
        <SearchBox id="sale-search" value={search} onChange={reset(setSearch)} placeholder="Search number or customer" />
        <label className="flex items-center gap-2 text-sm text-ink-soft">From <input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={filterClass} aria-label="From date" /></label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">To <input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className={filterClass} aria-label="To date" /></label>
        {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setPage(1); }}>Clear dates</Button>}
      </Toolbar>

      <div className="mb-4">
        <Chips<Filter>
          label="Payment status" value={filter} onChange={reset(setFilter)}
          options={[
            { value: "all", label: "All", count: m?.orders },
            { value: "paid", label: "Paid" },
            { value: "partial", label: "Part paid" },
            { value: "unpaid", label: "Unpaid" },
            { value: "void", label: "Void", count: m?.voided },
          ]}
        />
      </div>

      <TableCard min="52rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Sale</th>
            <th scope="col" className={thClass}>Customer</th>
            {s.level !== "branch" && <th scope="col" className={thClass}>Branch</th>}
            <th scope="col" className={`${thClass} text-right`}>Total</th>
            <th scope="col" className={`${thClass} text-right`}>Owed</th>
            <th scope="col" className={thClass}>Payment</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={7} />}
          {list.error && <TableError cols={7} message={(list.error as Error).message} />}
          {list.data?.data.length === 0 && <TableEmpty cols={7} title="No sales found" icon={ICON.cart} hint={s.can("sales.create") ? "Make a sale from the point of sale and it will appear here." : undefined} />}
          {list.data?.data.map((r) => (
            <tr key={r.id} className={r.status === "void" ? "opacity-60" : ""}>
              <td className="px-5 py-3.5">
                <Link href={`/sales/view?id=${r.id}`} className="font-mono text-xs font-bold text-[#f40009] hover:underline">{r.number}</Link>
                <span className="block text-xs text-ink-soft">{formatDateTime(r.sold_at)} · {r.lines_count} item{r.lines_count === 1 ? "" : "s"}</span>
              </td>
              <td className="px-4 py-3.5">{r.customer?.name ?? <span className="text-ink-soft">Walk-in</span>}</td>
              {s.level !== "branch" && <td className="px-4 py-3.5 text-ink-soft">{r.branch?.name}</td>}
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(r.total)}</td>
              <td className={`px-4 py-3.5 text-right ${r.balance_due > 0 ? "font-semibold text-amber-700" : "text-ink-soft"}`}>{r.balance_due > 0 ? formatKobo(r.balance_due) : "–"}</td>
              <td className="px-4 py-3.5">{r.status === "void" ? <Badge tone="bad">Void</Badge> : <Badge tone={PAYMENT_TONE[r.payment_status]}>{PAYMENT_LABEL[r.payment_status]}</Badge>}</td>
              <td className="px-4 py-3.5 text-right"><Link href={`/sales/view?id=${r.id}`} className="text-sm font-semibold text-[#f40009] hover:underline">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.current_page} setPage={setPage} />}
    </>
  );
}
