"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Card, ICON, PageHeader, SearchBox, SelectField, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { whatsappNumber } from "../../../../lib/customer-insights";
import { formatKobo } from "../../../../lib/format";
import type { AgingReport, AgingRow } from "../../../../lib/types";

const COLS = [
  { key: "current", label: "0–30 days" },
  { key: "d31_60", label: "31–60 days" },
  { key: "d61_90", label: "61–90 days" },
  { key: "d90_plus", label: "Over 90" },
] as const;

function reminder(row: AgingRow, business: string) {
  const text = `Hello ${row.name}, this is a friendly reminder from ${business}. Your outstanding balance is ${formatKobo(row.total)}${row.oldest_days > 30 ? `, the oldest invoice is ${row.oldest_days} days old` : ""}. Kindly arrange payment. Thank you.`;
  const phone = whatsappNumber(row.phone);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
}

export default function AgingPage() {
  const s = useSession();
  const [over, setOver] = useState("");
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["customer-aging", over, search], queryFn: () => api<AgingReport>(`/customers/aging?${new URLSearchParams({ ...(over ? { over } : {}), ...(search ? { search } : {}) })}`) });
  const d = q.data;

  return (
    <div>
      <PageHeader title="Who owes us" description="Unpaid sales grouped by how long they have been open. Send a WhatsApp reminder in one tap." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><p className="text-sm text-ink-soft">Total owed</p><p className="mt-0.5 text-2xl font-bold">{formatKobo(d?.summary.total ?? 0)}</p><p className="text-xs text-ink-soft">{d?.summary.customers ?? 0} customers</p></Card>
        {COLS.map((c) => (
          <Card key={c.key}><p className="text-sm text-ink-soft">{c.label}</p><p className={`mt-0.5 text-xl font-bold ${c.key === "d90_plus" && (d?.summary.d90_plus ?? 0) > 0 ? "text-[#c23a3a]" : ""}`}>{formatKobo(d?.summary[c.key] ?? 0)}</p></Card>
        ))}
      </div>

      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search customer or phone" />
        <SelectField label="Oldest invoice" value={over} onChange={setOver} options={[{ value: "", label: "Any age" }, { value: "30", label: "Over 30 days" }, { value: "60", label: "Over 60 days" }, { value: "90", label: "Over 90 days" }]} />
      </Toolbar>

      <TableCard min="56rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Customer</th>
            {COLS.map((c) => <th key={c.key} scope="col" className={`${thClass} text-right`}>{c.label}</th>)}
            <th scope="col" className={`${thClass} text-right`}>Total</th>
            <th scope="col" className={`${thClass} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={7} />}
          {q.error && <TableError cols={7} message={(q.error as Error).message} />}
          {d && d.data.length === 0 && <TableEmpty cols={7} title="Nobody owes anything" hint="Unpaid sales to named customers show up here." icon={ICON.cash} />}
          {d?.data.map((r) => {
            const wa = reminder(r, s.store?.name ?? "us");
            return (
              <tr key={r.customer_id}>
                <td className="px-5 py-3.5">
                  <Link href={`/customers/view?id=${r.customer_id}`} className="font-semibold hover:underline">{r.name}</Link>
                  <span className="block text-xs text-ink-soft">{r.phone ?? "No phone"} · {r.invoices} unpaid {r.invoices === 1 ? "sale" : "sales"} · oldest {r.oldest_days} days{r.credit_limit > 0 && r.total > r.credit_limit ? " · over limit" : ""}</span>
                </td>
                {COLS.map((c) => <td key={c.key} className={`px-4 py-3.5 text-right ${c.key === "d90_plus" && r[c.key] > 0 ? "font-semibold text-[#c23a3a]" : ""}`}>{r[c.key] ? formatKobo(r[c.key]) : "–"}</td>)}
                <td className="px-4 py-3.5 text-right font-bold">{formatKobo(r.total)}</td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  {wa ? <a href={wa} target="_blank" rel="noreferrer" className="mr-3 text-sm font-semibold text-[#f40009] hover:underline">WhatsApp</a> : <span className="mr-3 text-xs text-ink-soft">No phone</span>}
                  <Link href={`/customers/statement?id=${r.customer_id}`} className="text-sm font-semibold text-[#f40009] hover:underline">Statement</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
    </div>
  );
}
