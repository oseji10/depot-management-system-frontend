"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CustomerModal } from "../../../components/customer-form";
import { ImportCustomersButton } from "../../../components/import-buttons";
import {
  Badge, Button, Chips, ICON, PageHeader, Pager, SearchBox, Svg, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass,
} from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatKobo, relativeDay } from "../../../lib/format";
import type { Customer, Paginated } from "../../../lib/types";

type Filter = "all" | "owing" | "wholesale" | "inactive";

export default function CustomersPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const list = useQuery({
    queryKey: ["customers", page, search, filter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page) });
      if (search) p.set("search", search);
      if (filter === "owing") p.set("owing", "1");
      if (filter === "wholesale") p.set("type", "wholesale");
      if (filter === "inactive") p.set("active", "0");
      return api<Paginated<Customer>>(`/customers?${p}`);
    },
  });

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who you sell to, what they owe, and how much credit they can have."
        action={s.can("customers.manage") && <div className="flex gap-2"><ImportCustomersButton /><Button onClick={() => setAdding(true)}><Svg d={ICON.plus} /> Add customer</Button></div>}
      />

      <Toolbar>
        <SearchBox id="cust-search" value={search} onChange={change(setSearch)} placeholder="Search name or phone" />
        {list.data && <span className="ml-auto pr-1 text-sm text-ink-soft">{list.data.total} customer{list.data.total === 1 ? "" : "s"}</span>}
      </Toolbar>

      <div className="mb-4">
        <Chips<Filter> label="Show" value={filter} onChange={change(setFilter)} options={[
          { value: "all", label: "Everyone" }, { value: "owing", label: "Owing money" }, { value: "wholesale", label: "Wholesale" }, { value: "inactive", label: "Inactive" },
        ]} />
      </div>

      <TableCard min="50rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Customer</th>
            <th scope="col" className={thClass}>Phone</th>
            <th scope="col" className={`${thClass} text-right`}>Orders</th>
            <th scope="col" className={thClass}>Last sale</th>
            <th scope="col" className={`${thClass} text-right`}>Credit limit</th>
            <th scope="col" className={`${thClass} text-right`}>Owes</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={7} />}
          {list.error && <TableError cols={7} message={(list.error as Error).message} />}
          {list.data?.data.length === 0 && <TableEmpty cols={7} title="No customers found" icon={ICON.people} hint="Add a customer here, or from the till while making a sale." />}
          {list.data?.data.map((c) => (
            <tr key={c.id} className={c.is_active ? "" : "opacity-60"}>
              <td className="px-5 py-3.5">
                <Link href={`/customers/view?id=${c.id}`} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffe9ea] text-sm font-bold text-[#f40009]">{c.name.charAt(0).toUpperCase()}</span>
                  <span><span className="block font-semibold hover:text-[#f40009]">{c.name}</span><span className="block text-xs text-ink-soft">{c.type === "wholesale" ? "Wholesale" : "Retail"}{!c.is_active && " · inactive"}</span></span>
                </Link>
              </td>
              <td className="px-4 py-3.5 text-ink-soft">{c.phone ?? "–"}</td>
              <td className="px-4 py-3.5 text-right">{c.orders_count}</td>
              <td className="px-4 py-3.5 text-ink-soft">{c.last_sale_at ? relativeDay(c.last_sale_at) : "–"}</td>
              <td className="px-4 py-3.5 text-right">{c.credit_limit ? formatKobo(c.credit_limit) : <Badge>Cash only</Badge>}</td>
              <td className={`px-4 py-3.5 text-right ${(c.outstanding ?? 0) > 0 ? "font-semibold text-amber-700" : "text-ink-soft"}`}>{(c.outstanding ?? 0) > 0 ? formatKobo(c.outstanding ?? 0) : "–"}</td>
              <td className="px-4 py-3.5 text-right"><Link href={`/customers/view?id=${c.id}`} className="text-sm font-semibold text-[#f40009] hover:underline">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.current_page} setPage={setPage} />}

      {adding && <CustomerModal onClose={() => setAdding(false)} />}
    </>
  );
}
