"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { formatDate, formatKobo } from "../lib/format";
import { BarChart, Card, ErrorNote, Stat, filterClass } from "./ui";

type Named = { name: string };
type Overview = {
  period: { from: string; to: string };
  sales: null | {
    total: number; orders: number; average_order: number; collected: number; voided: number; owed_now: number; customers_owing: number; customers: number;
    by_method: Record<string, number>; daily: { date: string; total: number; orders: number }[];
    top_products: (Named & { units: number; revenue: number })[]; by_branch: (Named & { total: number; orders: number })[]; top_customers: (Named & { total: number; orders: number })[];
  };
  expenses: null | { total: number; by_category: (Named & { amount: number })[] };
  stock: null | { saleable_units: number; damaged_units: number; expired_units: number; expiring_units: number; products_in_stock: number };
  accounts: null | {
    revenue: number; cogs: number; gross_profit: number; expenses: number; net_profit: number; cash: number; bank: number; receivables: number;
    payables: number; container_deposits: number; imprest_out: number; fuel_prepaid: number; staff_owe: number;
  };
  field: null | { trips: number; on_road: number; cash_variance: number; sync_issues: number };
  people: null | { employees: number; monthly_basic: number; last_payroll: { period: string; status: string; net: number } | null; charges_pending: number | null; charges_outstanding: number | null };
  fleet: null | { vehicles: number; available: number; in_workshop: number; docs_expired: number; docs_soon: number; imprest_issued: number; fuel_vouchers_out: number | null };
};

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const PRESETS = {
  today: () => { const t = iso(new Date()); return [t, t]; },
  week: () => { const d = new Date(); d.setDate(d.getDate() - 6); return [iso(d), iso(new Date())]; },
  month: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)]; },
  last: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; },
  year: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), 0, 1)), iso(d)]; },
} as const;
const PRESET_LABEL = { today: "Today", week: "Last 7 days", month: "This month", last: "Last month", year: "This year" } as const;
const METHOD = { cash: "Cash", transfer: "Transfer", pos: "Card (POS)" } as Record<string, string>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows, empty }: { rows: { label: ReactNode; value: ReactNode; sub?: ReactNode }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start justify-between gap-3 py-2">
          <span>{r.label}{r.sub ? <span className="block text-xs text-ink-soft">{r.sub}</span> : null}</span>
          <span className="font-semibold tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function OverviewReport() {
  const [preset, setPreset] = useState<keyof typeof PRESETS | "custom">("month");
  const [range, setRange] = useState<string[]>(PRESETS.month());
  const [from, to] = range;

  const q = useQuery({ queryKey: ["overview", from, to], queryFn: () => api<Overview>(`/overview?from=${from}&to=${to}`), enabled: !!from && !!to && from <= to });
  const d = q.data;
  const n = (v: number) => v.toLocaleString("en-NG");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-sm print:hidden">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
          <button key={k} type="button" onClick={() => { setPreset(k); setRange(PRESETS[k]()); }}
            className={`min-h-9 rounded-lg px-3 text-sm ${preset === k ? "bg-gradient-to-b from-[#ff3b3f] to-[#f40009] font-semibold text-white" : "border border-line text-ink-soft hover:text-ink"}`}>{PRESET_LABEL[k]}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">From <input type="date" value={from} max={to} onChange={(e) => { setPreset("custom"); setRange([e.target.value, to]); }} className={filterClass} /></label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">To <input type="date" value={to} min={from} onChange={(e) => { setPreset("custom"); setRange([from, e.target.value]); }} className={filterClass} /></label>
        <button type="button" onClick={() => window.print()} className="min-h-9 rounded-lg border border-line px-3 text-sm font-semibold">Print</button>
      </div>

      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      {q.isLoading && <p className="text-sm text-ink-soft">Gathering the figures…</p>}

      {d && (
        <>
          <p className="text-sm text-ink-soft">Figures for {formatDate(d.period.from)} to {formatDate(d.period.to)}. Stock, balances and people are as of today.</p>

          {d.accounts && (
            <Section title="Profit and cash">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Revenue" value={formatKobo(d.accounts.revenue)} />
                <Stat label="Gross profit" value={formatKobo(d.accounts.gross_profit)} tone="blue" note={`After ${formatKobo(d.accounts.cogs)} cost of goods`} />
                <Stat label="Expenses" value={formatKobo(d.accounts.expenses)} tone="amber" />
                <Stat label="Net profit" value={formatKobo(d.accounts.net_profit)} tone={d.accounts.net_profit < 0 ? "rose" : "green"} note="From posted journals" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Cash on hand" value={formatKobo(d.accounts.cash)} />
                <Stat label="Bank" value={formatKobo(d.accounts.bank)} />
                <Stat label="Customers owe" value={formatKobo(d.accounts.receivables)} tone="amber" />
                <Stat label="We owe suppliers" value={formatKobo(d.accounts.payables)} tone="rose" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Container deposits held" value={formatKobo(d.accounts.container_deposits)} tone="blue" />
                <Stat label="Imprest with drivers" value={formatKobo(d.accounts.imprest_out)} tone="amber" />
                <Stat label="Prepaid with fuel stations" value={formatKobo(d.accounts.fuel_prepaid)} />
                <Stat label="Staff owe the business" value={formatKobo(d.accounts.staff_owe)} tone="amber" />
              </div>
              <p className="text-sm"><span className="text-ink-soft">The full income statement, balance sheet and ledger are on the other tabs.</span></p>
            </Section>
          )}

          {d.sales && (
            <Section title="Sales">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Sales" value={formatKobo(d.sales.total)} note={`${n(d.sales.orders)} orders`} />
                <Stat label="Average order" value={formatKobo(d.sales.average_order)} tone="blue" />
                <Stat label="Money collected" value={formatKobo(d.sales.collected)} note={Object.entries(d.sales.by_method).map(([k, v]) => `${METHOD[k] ?? k} ${formatKobo(v)}`).join(" · ") || undefined} />
                <Stat label="Owed by customers now" value={formatKobo(d.sales.owed_now)} tone="amber" note={`${n(d.sales.customers_owing)} customer${d.sales.customers_owing === 1 ? "" : "s"} · ${n(d.sales.voided)} voided in period`} />
              </div>
              {d.sales.daily.length > 0 && (
                <Card title="Sales by day">
                  <BarChart points={d.sales.daily.map((x) => ({ label: x.date.slice(5), value: x.total, hint: formatDate(x.date) }))} format={formatKobo} />
                </Card>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Best-selling products">
                  <Rows empty="No sales in this period." rows={d.sales.top_products.map((p) => ({ label: p.name, sub: `${n(p.units)} units`, value: formatKobo(p.revenue) }))} />
                </Card>
                <Card title="Sales by branch">
                  <Rows empty="No sales in this period." rows={d.sales.by_branch.map((b) => ({ label: b.name, sub: `${n(b.orders)} orders`, value: formatKobo(b.total) }))} />
                </Card>
                <Card title="Top customers">
                  <Rows empty="No customer sales in this period." rows={d.sales.top_customers.map((c) => ({ label: c.name, sub: `${n(c.orders)} orders`, value: formatKobo(c.total) }))} />
                </Card>
                {d.expenses && (
                  <Card title={`Expenses · ${formatKobo(d.expenses.total)}`}>
                    <Rows empty="No expenses in this period." rows={d.expenses.by_category.map((c) => ({ label: c.name, value: formatKobo(c.amount) }))} />
                  </Card>
                )}
              </div>
            </Section>
          )}

          {!d.sales && d.expenses && (
            <Section title="Expenses">
              <Card title={formatKobo(d.expenses.total)}><Rows empty="No expenses in this period." rows={d.expenses.by_category.map((c) => ({ label: c.name, value: formatKobo(c.amount) }))} /></Card>
            </Section>
          )}

          {d.stock && (
            <Section title="Stock">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Saleable units" value={n(d.stock.saleable_units)} note={`${n(d.stock.products_in_stock)} products in stock`} />
                <Stat label="Damaged units" value={n(d.stock.damaged_units)} tone="rose" />
                <Stat label="Expiring within 30 days" value={n(d.stock.expiring_units)} tone="amber" href="/stock/expiry" />
                <Stat label="Expired units" value={n(d.stock.expired_units)} tone="rose" href="/stock/expiry" />
              </div>
            </Section>
          )}

          {d.field && (
            <Section title="Van sales">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Trips in period" value={n(d.field.trips)} />
                <Stat label="On the road now" value={n(d.field.on_road)} tone="blue" href="/field/trips" />
                <Stat label="Cash variance on closed trips" value={formatKobo(d.field.cash_variance)} tone={d.field.cash_variance < 0 ? "rose" : "green"} note="Negative means cash was short" />
                <Stat label="Sync issues open" value={n(d.field.sync_issues)} tone={d.field.sync_issues ? "amber" : "green"} href="/field/issues" />
              </div>
            </Section>
          )}

          {d.fleet && (
            <Section title="Fleet">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Vehicles" value={n(d.fleet.vehicles)} note={`${n(d.fleet.available)} available · ${n(d.fleet.in_workshop)} in workshop`} href="/vehicles" />
                <Stat label="Papers expired" value={n(d.fleet.docs_expired)} tone={d.fleet.docs_expired ? "rose" : "green"} note={`${n(d.fleet.docs_soon)} expiring within 30 days`} href="/vehicles" />
                <Stat label="Imprest out with drivers" value={formatKobo(d.fleet.imprest_issued)} tone="amber" />
                {d.fleet.fuel_vouchers_out !== null && <Stat label="Fuel issued this month" value={formatKobo(d.fleet.fuel_vouchers_out)} tone="amber" href="/fuel" />}
              </div>
            </Section>
          )}

          {d.people && (
            <Section title="People">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Employees" value={n(d.people.employees)} href="/employees" />
                <Stat label="Monthly basic payroll" value={formatKobo(d.people.monthly_basic)} tone="blue" />
                <Stat label="Last payroll" value={d.people.last_payroll ? formatKobo(d.people.last_payroll.net) : "–"} note={d.people.last_payroll ? `${d.people.last_payroll.period} · ${d.people.last_payroll.status}` : "No run yet"} href="/payroll" />
                {d.people.charges_outstanding !== null && <Stat label="Staff charges to recover" value={formatKobo(d.people.charges_outstanding)} tone="amber" note={`${n(d.people.charges_pending ?? 0)} awaiting approval`} href="/staff-charges" />}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
