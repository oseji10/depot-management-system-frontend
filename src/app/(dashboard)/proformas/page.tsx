"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Chips, ICON, PageHeader, Pager, SearchBox, Svg, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate, formatKobo } from "../../../lib/format";
import { PROFORMA_LABEL, PROFORMA_TONE } from "../../../lib/status";
import type { Paginated, Proforma } from "../../../lib/types";

type Filter = "all" | "draft" | "sent" | "accepted" | "expired" | "converted" | "cancelled";

export default function ProformasPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery({
    queryKey: ["list", "/proformas", page, search, filter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page) });
      if (search) p.set("search", search);
      if (filter !== "all") p.set("status", filter);
      return api<Paginated<Proforma>>(`/proformas?${p}`);
    },
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Proforma invoices"
        description="Price quotations for customers. Send them, print them, and turn an accepted one into a sale."
        action={s.can("proformas.manage") && <Link href="/proformas/new"><Button><Svg d={ICON.plus} /> New proforma</Button></Link>}
      />

      <Toolbar>
        <SearchBox id="pf-list-search" value={search} onChange={reset(setSearch)} placeholder="Search number, name or phone" />
      </Toolbar>

      <div className="mb-4">
        <Chips<Filter>
          label="Status" value={filter} onChange={reset(setFilter)}
          options={[
            { value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "accepted", label: "Accepted" },
            { value: "expired", label: "Expired" }, { value: "converted", label: "Became a sale" }, { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </div>

      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Proforma</th>
            <th scope="col" className={thClass}>Customer</th>
            <th scope="col" className={thClass}>Valid until</th>
            <th scope="col" className={`${thClass} text-right`}>Total</th>
            <th scope="col" className={thClass}>Status</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={6} />}
          {list.error && <TableError cols={6} message={(list.error as Error).message} />}
          {list.data?.data.length === 0 && <TableEmpty cols={6} title="No proforma invoices" icon={ICON.cart} hint={s.can("proformas.manage") ? "Create one to send a customer a quotation." : undefined} />}
          {list.data?.data.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-3.5">
                <Link href={`/proformas/view?id=${r.id}`} className="font-mono text-xs font-bold text-[#f40009] hover:underline">{r.number}</Link>
                <span className="block text-xs text-ink-soft">{r.lines_count} item{r.lines_count === 1 ? "" : "s"}</span>
              </td>
              <td className="px-4 py-3.5">{r.customer_name}</td>
              <td className={`px-4 py-3.5 ${r.is_expired ? "font-semibold text-amber-700" : "text-ink-soft"}`}>{r.valid_until ? formatDate(r.valid_until) : "No expiry"}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(r.total)}</td>
              <td className="px-4 py-3.5">
                <Badge tone={PROFORMA_TONE[r.status]}>{PROFORMA_LABEL[r.status]}</Badge>
                {r.is_expired && <span className="ml-1"><Badge tone="warn">Expired</Badge></span>}
              </td>
              <td className="px-4 py-3.5 text-right"><Link href={`/proformas/view?id=${r.id}`} className="text-sm font-semibold text-[#f40009] hover:underline">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.current_page} setPage={setPage} />}
    </>
  );
}
