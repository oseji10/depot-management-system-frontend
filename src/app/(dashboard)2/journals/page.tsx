"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import {
  Badge, Button, FilterSelect, ICON, Pager, PageHeader, SearchBox, Svg, TableCard, TableEmpty, TableError, TableLoading,
  Toolbar, filterClass, theadClass, thClass,
} from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatAmount, formatDate, sourceLabel } from "../../../lib/format";
import type { JournalEntry, Paginated } from "../../../lib/types";

export default function JournalsPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/journals", page, deferred, status, from, to],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (deferred) q.set("search", deferred);
      if (status) q.set("status", status);
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return api<Paginated<JournalEntry>>(`/journals?${q}`);
    },
  });

  const hasFilters = Boolean(search || status || from || to);
  const reset = () => { setSearch(""); setStatus(""); setFrom(""); setTo(""); setPage(1); };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Journals"
        description="Every change to your books. Most entries are posted automatically from receipts, adjustments and counts; you can also record your own."
        action={s.can("journals.create") && <Link href="/journals/new"><Button><Svg d={ICON.plus} /> New journal</Button></Link>}
      />

      <Toolbar>
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search number or description" />
        <FilterSelect id="jr-status" label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="draft">Drafts</option>
          <option value="posted">Posted</option>
        </FilterSelect>
        <label className="sr-only" htmlFor="jr-from">From date</label>
        <input id="jr-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={filterClass} />
        <label className="sr-only" htmlFor="jr-to">To date</label>
        <input id="jr-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={filterClass} />
        {hasFilters && (
          <button onClick={reset} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#f40009] transition hover:bg-[#ffe9ea]">
            <Svg d={ICON.x} /> Clear
          </button>
        )}
        {data && <span className="ml-auto pr-1 text-sm text-ink-soft">{data.total} entr{data.total === 1 ? "y" : "ies"}</span>}
      </Toolbar>

      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Entry</th>
            <th scope="col" className={thClass}>Date</th>
            <th scope="col" className={thClass}>Description</th>
            <th scope="col" className={thClass}>From</th>
            <th scope="col" className={`${thClass} text-right`}>Amount</th>
            <th scope="col" className={thClass}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isLoading && <TableLoading cols={6} />}
          {error && <TableError cols={6} message={(error as Error).message} />}
          {data?.data.length === 0 && (
            <TableEmpty cols={6} title="No journal entries found" icon={ICON.doc}
              hint={hasFilters ? "Try different filters." : "Entries appear here as soon as stock is received or adjusted."} />
          )}
          {data?.data.map((j) => (
            <tr key={j.id} className="transition-colors hover:bg-[#fff5f5]">
              <td className="px-5 py-3.5">
                <Link href={`/journals/view?id=${j.id}`} className="font-mono text-xs font-semibold text-[#f40009] hover:underline">{j.number}</Link>
              </td>
              <td className="px-4 py-3.5">{formatDate(j.entry_date)}</td>
              <td className="max-w-xs truncate px-4 py-3.5" title={j.memo}>{j.memo}</td>
              <td className="px-4 py-3.5 text-ink-soft">{sourceLabel(j.source_type)}</td>
              <td className="px-4 py-3.5 text-right font-medium">{formatAmount(j.total)}</td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={j.status === "posted" ? "good" : "warn"}>{j.status === "posted" ? "Posted" : "Draft"}</Badge>
                  {j.reversed_at && <Badge tone="bad">Reversed</Badge>}
                  {j.reversal_of_id && <Badge>Reversal</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {data && <Pager page={page} last={data.last_page} total={data.total} current={data.current_page} setPage={setPage} />}
    </div>
  );
}
