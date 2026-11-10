"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AreaChart, ChartCard, CHART_CSS, ColumnChart, Delta, Donut, RankBars, Stat } from "../../../components/charts";
import { PageHeader } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatKobo } from "../../../lib/format";

type Totals = {
  sales: number; orders: number; average_order: number; discount: number; collected: number; owed: number; cogs: number; gross_profit: number;
  expenses: number; net_profit: number; returns: number; return_count: number; customers: number;
  units: number; avg_spend: number; new_customers: number;
};
type SeriesRow = { date: string; sales: number; orders: number; discount: number; expenses: number; collected: number; gross_profit: number; returns: number; units: number; buyers: number; new_customers: number; avg_spend: number };
type Analytics = {
  range: { from: string; to: string; days: number; granularity: "day" | "month" };
  previous: { from: string; to: string; totals: Totals; series: SeriesRow[] };
  totals: Totals;
  series: SeriesRow[];
  by_channel: { key: string; amount: number; count: number }[];
  by_payment_status: { key: string; amount: number; count: number }[];
  by_method: { key: string; amount: number; count: number }[];
  by_weekday: { day: number; amount: number; count: number }[];
  by_hour: { hour: number; amount: number; count: number }[];
  by_branch: { id: number; name: string; amount: number; count: number; expenses: number }[];
  products: { id: number; name: string; units: number; revenue: number; cost: number; profit: number }[];
  customers: { top: Cust[]; top_orders: Cust[]; on_file: number; buyers: number; returning: number; new_buyers: number; new_on_file: number; walk_in_sales: number; walk_in_amount: number };
  expenses_by_category: { name: string; amount: number; count: number }[];
  basket: { items_per_sale: number; units_per_sale: number };
  receivables: { amount: number; sales: number; customers: number };
  missing_cost: boolean;
  transactions: { total: number; rows: Txn[] };
  catalogue: Catalogue;
  discounts: Discounts;
};

type Cust = { id: number; name: string; amount: number; orders: number; owes: number };
type Txn = { id: number; date: string | null; number: string | null; customer: string | null; amount: number; method: string; channel: string | null; status: string; reference: string | null };
type Catalogue = { total_products: number; stock_units: number; stock_value: number; stock_value_products: number; out_of_stock: number; out_of_stock_names: string[]; categories: number; pack_sizes: number; top_categories: { name: string; units: number }[]; slow_movers: { id: number; name: string; stock: number }[] };
type Discounts = { sales_with_discount: number; share_of_sales: number; average_discount: number; by_channel: { key: string; amount: number; count: number }[]; top_products: { id: number; name: string; discount: number; units: number }[]; rebates: { count: number; amount: number; by_status: { key: string; amount: number; count: number }[] } };

type Tab = "sales" | "transactions" | "products" | "customers" | "promos" | "profit";
const TABS: { id: Tab; label: string }[] = [
  { id: "sales", label: "Sales" }, { id: "transactions", label: "Transactions" }, { id: "products", label: "Products" },
  { id: "customers", label: "Customers" }, { id: "promos", label: "Discounts & promos" }, { id: "profit", label: "Profit & expenses" },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const PRESETS = [
  { id: "7d", label: "Last 7 days", range: () => [addDays(new Date(), -6), new Date()] },
  { id: "30d", label: "Last 30 days", range: () => [addDays(new Date(), -29), new Date()] },
  { id: "month", label: "This month", range: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; } },
  { id: "lastmonth", label: "Last month", range: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)]; } },
  { id: "year", label: "This year", range: () => { const n = new Date(); return [new Date(n.getFullYear(), 0, 1), n]; } },
  { id: "custom", label: "Custom", range: () => [addDays(new Date(), -29), new Date()] },
] as const;

const CHANNELS: Record<string, string> = { counter: "Counter", phone: "Phone order", delivery: "Delivery", field: "Salesperson (van)", van: "Salesperson (van)", pos: "POS" };
const METHODS: Record<string, string> = { cash: "Cash", transfer: "Bank transfer", pos: "Card / POS", credit: "On account" };
const STATUS: Record<string, string> = { paid: "Fully paid", partial: "Part paid", unpaid: "Not paid (credit)" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function label(date: string, g: "day" | "month") {
  const d = new Date(date.length === 7 ? `${date}-01T00:00:00` : `${date}T00:00:00`);
  return g === "day" ? d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : d.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
}
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
const pctOf = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

export default function AnalyticsPage() {
  const s = useSession();
  const [tab, setTab] = useState<Tab>("sales");
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("30d");
  const [from, setFrom] = useState(() => ymd(addDays(new Date(), -29)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [branch, setBranch] = useState("");
  const [compare, setCompare] = useState(true);
  const branches = useOptions("/branches");
  const [txMethod, setTxMethod] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txSearch, setTxSearch] = useState("");

  const pick = (id: (typeof PRESETS)[number]["id"]) => {
    setPreset(id);
    const [a, b] = PRESETS.find((p) => p.id === id)!.range();
    if (id !== "custom") { setFrom(ymd(a)); setTo(ymd(b)); }
  };

  const valid = !!from && !!to && from <= to;
  const q = useQuery({
    queryKey: ["analytics", from, to, branch],
    enabled: valid,
    queryFn: () => api<Analytics>(`/analytics?from=${from}&to=${to}${branch ? `&branch_id=${branch}` : ""}`),
    placeholderData: (prev) => prev,
  });
  const d = q.data;

  const g = d?.range.granularity ?? "day";
  const pts = (key: keyof SeriesRow) => (d?.series ?? []).map((r, i) => ({ label: label(r.date, g), value: r[key] as number, prev: compare ? (d?.previous.series[i]?.[key] as number | undefined) : undefined }));
  const cols = (key: keyof SeriesRow) => (d?.series ?? []).map((r) => ({ label: label(r.date, g), value: r[key] as number }));
  const T = d?.totals; const P = d?.previous.totals;
  const dl = (k: keyof Totals, upIsGood = true) => (compare && T && P ? <Delta now={T[k]} before={P[k]} upIsGood={upIsGood} /> : undefined);

  const txRows = useMemo(() => {
    const t = txSearch.trim().toLowerCase();
    return (d?.transactions.rows ?? []).filter((r) => (!txMethod || r.method === txMethod) && (!txStatus || r.status === txStatus) && (!t || (r.customer ?? "walk-in customer").toLowerCase().includes(t) || (r.number ?? "").toLowerCase().includes(t)));
  }, [d, txMethod, txStatus, txSearch]);

  const channelItems = useMemo(() => (d?.by_channel ?? []).map((c) => ({ label: CHANNELS[c.key] ?? cap(c.key), value: c.amount })), [d]);

  if (!s.can("reports.view")) return <p className="text-sm text-ink-soft">You do not have access to analytics.</p>;

  return (
    <div className="viz">
      <style>{CHART_CSS}</style>
      <PageHeader title="Analytics" description="How the depot is selling, earning and spending, for any period you choose." />

      {/* Filters: one row above the charts */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <label className="text-xs font-medium text-ink-soft">Period
          <select value={preset} onChange={(e) => pick(e.target.value as typeof preset)} className="mt-1 block min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-soft">From
          <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="mt-1 block min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink" />
        </label>
        <label className="text-xs font-medium text-ink-soft">To
          <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="mt-1 block min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink" />
        </label>
        {s.level !== "branch" && branches.length > 1 && (
          <label className="text-xs font-medium text-ink-soft">Branch
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 block min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[#f40009]" /> Compare with the period before</label>
        {q.isFetching && <span className="pb-3 text-xs text-ink-soft">Updating…</span>}
      </div>

      {!valid && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">Pick a start date that is on or before the end date.</p>}
      {q.error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{(q.error as Error).message}</p>}
      {d && compare && <p className="mb-3 text-xs text-ink-soft">Comparing {label(d.range.from, "day")} – {label(d.range.to, "day")} with the {d.range.days} days before it.</p>}

      <div role="tablist" aria-label="Analytics sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition ${tab === t.id ? "border-[#f40009] text-[#c40008]" : "border-transparent text-ink-soft hover:text-ink"}`}>{t.label}</button>
        ))}
      </div>

      {!d && q.isLoading && <p className="py-16 text-center text-sm text-ink-soft">Crunching the numbers…</p>}

      {d && T && (
        <>
          {d.missing_cost && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p><b>Gross and net profit are not shown accurately.</b> No cost was recorded on these sales. Receive stock with its cost price to see real profit.</p>
              <Link href="/goods-receipts" className="font-semibold text-[#c40008] hover:underline">Goods receipts</Link>
            </div>
          )}

          {tab === "sales" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Total sales" value={formatKobo(T.sales)} delta={dl("sales")} />
                <Stat label="Orders" value={String(T.orders)} delta={dl("orders")} />
                <Stat label="Average order" value={formatKobo(T.average_order)} delta={dl("average_order")} />
                <Stat label="Discount given" value={formatKobo(T.discount)} delta={dl("discount", false)} hint={pctOf(T.discount, T.sales + T.discount) + " of list value"} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard wide title="Total sales" value={formatKobo(T.sales)} sub={dl("sales")} table={{ head: ["Date", "Sales", "Orders"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.sales), r.orders]) }}>
                  <AreaChart points={pts("sales")} name="Sales" />
                </ChartCard>
                <ChartCard title="Sales by channel" table={{ head: ["Channel", "Sales", "Orders"], rows: d.by_channel.map((c) => [CHANNELS[c.key] ?? cap(c.key), formatKobo(c.amount), c.count]) }}>
                  <Donut items={channelItems} centre="Sales" />
                </ChartCard>
                <ChartCard title="Sales by payment status" sub="Paid in full, part paid, or sold on credit" table={{ head: ["Status", "Sales", "Orders"], rows: d.by_payment_status.map((c) => [STATUS[c.key] ?? cap(c.key), formatKobo(c.amount), c.count]) }}>
                  <Donut items={d.by_payment_status.map((c) => ({ label: STATUS[c.key] ?? cap(c.key), value: c.amount }))} centre="Sales" />
                </ChartCard>
                <ChartCard title="Discount given" value={formatKobo(T.discount)} sub={dl("discount", false)} table={{ head: ["Date", "Discount"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.discount)]) }}>
                  <ColumnChart items={cols("discount")} name="Discount" />
                </ChartCard>
                <ChartCard title="Best days of the week" sub="Total sales by weekday" table={{ head: ["Day", "Sales", "Orders"], rows: d.by_weekday.map((w) => [DAYS[w.day], formatKobo(w.amount), w.count]) }}>
                  <ColumnChart items={d.by_weekday.map((w) => ({ label: DAYS[w.day], value: w.amount }))} name="Sales" highlightMax />
                </ChartCard>
                <ChartCard wide title="Busiest hours" sub="Total sales by hour of the day" table={{ head: ["Hour", "Sales", "Orders"], rows: d.by_hour.map((h) => [hourLabel(h.hour), formatKobo(h.amount), h.count]) }}>
                  <ColumnChart items={d.by_hour.map((h) => ({ label: hourLabel(h.hour), value: h.amount }))} name="Sales" highlightMax />
                </ChartCard>
                {d.by_branch.length > 1 && (
                  <ChartCard wide title="Sales by branch" table={{ head: ["Branch", "Sales", "Orders"], rows: d.by_branch.map((b) => [b.name, formatKobo(b.amount), b.count]) }}>
                    <RankBars items={d.by_branch.map((b) => ({ label: b.name, value: b.amount, note: `${b.count} orders` }))} />
                  </ChartCard>
                )}
              </div>
            </div>
          )}

          {tab === "transactions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Money collected" value={formatKobo(T.collected)} delta={dl("collected")} hint={`${d.transactions.total} payment${d.transactions.total === 1 ? "" : "s"} received`} />
                <Stat label="Still owed from these sales" value={formatKobo(T.owed)} delta={dl("owed", false)} />
                <Stat label="Owed to you, all time" value={formatKobo(d.receivables.amount)} hint={`${d.receivables.customers} customers · ${d.receivables.sales} sales`} />
                <Stat label="Returns" value={formatKobo(T.returns)} delta={dl("returns", false)} hint={`${T.return_count} return${T.return_count === 1 ? "" : "s"}`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard wide title="Money collected" value={formatKobo(T.collected)} sub={dl("collected")} table={{ head: ["Date", "Collected"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.collected)]) }}>
                  <AreaChart points={pts("collected")} name="Collected" />
                </ChartCard>
                <ChartCard title="How customers pay" sub="Payments received, by method" table={{ head: ["Method", "Amount", "Payments"], rows: d.by_method.map((m) => [METHODS[m.key] ?? cap(m.key), formatKobo(m.amount), m.count]) }}>
                  <Donut items={d.by_method.map((m) => ({ label: METHODS[m.key] ?? cap(m.key), value: m.amount }))} centre="Collected" />
                </ChartCard>
                <ChartCard title="Orders over time" value={String(T.orders)} sub={dl("orders")} table={{ head: ["Date", "Orders"], rows: d.series.map((r) => [label(r.date, g), r.orders]) }}>
                  <ColumnChart items={cols("orders")} kind="count" name="Orders" />
                </ChartCard>
                <ChartCard title="Returns over time" value={formatKobo(T.returns)} sub={dl("returns", false)} table={{ head: ["Date", "Returned"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.returns)]) }}>
                  <ColumnChart items={cols("returns")} name="Returns" />
                </ChartCard>
                <ChartCard title="Basket size" sub="What a typical sale holds">
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div><p className="text-2xl font-bold">{d.basket.items_per_sale}</p><p className="text-xs text-ink-soft">product lines per sale</p></div>
                    <div><p className="text-2xl font-bold">{d.basket.units_per_sale}</p><p className="text-xs text-ink-soft">bottles/cans per sale</p></div>
                  </div>
                </ChartCard>
              </div>

              <section className="viz min-w-0 rounded-2xl border border-line bg-surface shadow-sm">
                <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
                  <div className="mr-auto"><h3 className="text-[13px] font-medium text-ink-soft">Transaction history</h3><p className="text-xs text-ink-soft">Payments received in this period{d.transactions.total > d.transactions.rows.length ? `, latest ${d.transactions.rows.length} of ${d.transactions.total}` : ""}</p></div>
                  <select aria-label="Payment method" value={txMethod} onChange={(e) => setTxMethod(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm"><option value="">All methods</option>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <select aria-label="Status" value={txStatus} onChange={(e) => setTxStatus(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm"><option value="">Any status</option><option value="completed">Completed</option><option value="voided">Voided</option></select>
                  <input type="search" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search customer or sale no." className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm" />
                </div>
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="sticky top-0 border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase"><tr><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Sale</th><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 text-right font-medium">Amount</th><th className="px-4 py-2.5 font-medium">Method</th><th className="px-4 py-2.5 font-medium">Source</th><th className="px-4 py-2.5 font-medium">Status</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {txRows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-soft">No payments match.</td></tr>}
                      {txRows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2.5 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–"}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{r.number ?? "–"}</td>
                          <td className="px-4 py-2.5">{r.customer ?? "Walk-in customer"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{formatKobo(r.amount)}</td>
                          <td className="px-4 py-2.5">{METHODS[r.method] ?? cap(r.method)}</td>
                          <td className="px-4 py-2.5">{r.channel ? (CHANNELS[r.channel] ?? cap(r.channel)) : "–"}</td>
                          <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "voided" ? "bg-red-50 text-[#c23a3a]" : "bg-green-50 text-green-700"}`}>{r.status === "voided" ? "Voided" : "Completed"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === "products" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-6">
                <Stat label="Active products" value={String(d.catalogue.total_products)} />
                <Stat label="Stock on hand" value={d.catalogue.stock_units.toLocaleString("en-NG")} hint="Bottles and cans, saleable" />
                <Stat label="Stock value" value={d.catalogue.stock_value > 0 ? formatKobo(d.catalogue.stock_value) : "–"} hint={d.catalogue.stock_value > 0 ? `At cost, from past sales (${d.catalogue.stock_value_products} products)` : "Needs past sales with cost"} />
                <Stat label="Out of stock" value={String(d.catalogue.out_of_stock)} />
                <Stat label="Categories" value={String(d.catalogue.categories)} />
                <Stat label="Pack sizes" value={String(d.catalogue.pack_sizes)} hint="Bottle, crate, pack…" />
              </div>
              <ChartCard wide title="Bottles and cans sold" value={T.units.toLocaleString("en-NG")} sub={dl("units")} table={{ head: ["Date", "Units sold"], rows: d.series.map((r) => [label(r.date, g), r.units]) }}>
                <ColumnChart items={cols("units")} kind="count" name="Units sold" />
              </ChartCard>
              <ChartCard title="Best sellers by revenue" sub="Top 10" table={{ head: ["Product", "Revenue", "Units"], rows: d.products.map((p) => [p.name, formatKobo(p.revenue), p.units]) }}>
                <RankBars items={d.products.slice(0, 10).map((p) => ({ label: p.name, value: p.revenue, note: `${p.units.toLocaleString("en-NG")} units sold` }))} />
              </ChartCard>
              <ChartCard title="Best sellers by units" sub="Bottles and cans, whatever pack they were sold in" table={{ head: ["Product", "Units"], rows: [...d.products].sort((a, b) => b.units - a.units).map((p) => [p.name, p.units]) }}>
                <RankBars kind="count" items={[...d.products].sort((a, b) => b.units - a.units).slice(0, 10).map((p) => ({ label: p.name, value: p.units }))} />
              </ChartCard>
              {!d.missing_cost && (
                <ChartCard wide title="Most profitable products" sub="Revenue minus cost of goods" table={{ head: ["Product", "Profit", "Margin"], rows: [...d.products].sort((a, b) => b.profit - a.profit).map((p) => [p.name, formatKobo(p.profit), pctOf(p.profit, p.revenue)]) }}>
                  <RankBars items={[...d.products].sort((a, b) => b.profit - a.profit).slice(0, 10).map((p) => ({ label: p.name, value: Math.max(0, p.profit), note: `${pctOf(p.profit, p.revenue)} margin` }))} />
                </ChartCard>
              )}
              <ChartCard title="Top categories" sub="Bottles and cans sold, by category" table={{ head: ["Category", "Units"], rows: d.catalogue.top_categories.map((c) => [c.name, c.units]) }}>
                <RankBars kind="count" items={d.catalogue.top_categories.map((c) => ({ label: c.name, value: c.units }))} />
              </ChartCard>
              <ChartCard title="Out of stock now" sub={d.catalogue.out_of_stock ? `${d.catalogue.out_of_stock} product${d.catalogue.out_of_stock === 1 ? "" : "s"} with nothing saleable` : undefined}>
                {d.catalogue.out_of_stock_names.length ? <ul className="space-y-1.5 text-sm">{d.catalogue.out_of_stock_names.map((n) => <li key={n} className="flex justify-between"><span>{n}</span><span className="text-ink-soft">0 left</span></li>)}{d.catalogue.out_of_stock > d.catalogue.out_of_stock_names.length && <li className="text-xs text-ink-soft">and {d.catalogue.out_of_stock - d.catalogue.out_of_stock_names.length} more</li>}</ul> : <p className="py-6 text-sm text-ink-soft">Everything is in stock.</p>}
              </ChartCard>
              <ChartCard wide title="Slow movers" sub="In stock but not sold at all in this period" table={{ head: ["Product", "In stock"], rows: d.catalogue.slow_movers.map((p) => [p.name, p.stock]) }}>
                <RankBars kind="count" items={d.catalogue.slow_movers.map((p) => ({ label: p.name, value: p.stock }))} empty="Every product in stock sold something." />
              </ChartCard>
              <section className="viz min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm lg:col-span-2">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase"><tr><th className="px-4 py-2.5 font-medium">Product</th><th className="px-4 py-2.5 text-right font-medium">Units</th><th className="px-4 py-2.5 text-right font-medium">Revenue</th>{!d.missing_cost && <><th className="px-4 py-2.5 text-right font-medium">Profit</th><th className="px-4 py-2.5 text-right font-medium">Margin</th></>}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.products.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">No product sales in this period.</td></tr>}
                    {d.products.map((p) => (
                      <tr key={p.id}><td className="px-4 py-2.5 font-medium">{p.name}</td><td className="px-4 py-2.5 text-right tabular-nums">{p.units.toLocaleString("en-NG")}</td><td className="px-4 py-2.5 text-right tabular-nums">{formatKobo(p.revenue)}</td>{!d.missing_cost && <><td className="px-4 py-2.5 text-right tabular-nums">{formatKobo(p.profit)}</td><td className="px-4 py-2.5 text-right tabular-nums">{pctOf(p.profit, p.revenue)}</td></>}</tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === "customers" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Customers on file" value={String(d.customers.on_file)} />
                <Stat label="Customers who bought" value={String(d.customers.buyers)} delta={dl("customers")} />
                <Stat label="Average spend per customer" value={formatKobo(T.avg_spend)} delta={dl("avg_spend")} />
                <Stat label="New buyers" value={String(d.customers.new_buyers)} hint="First purchase in this period" />
                <Stat label="Returning buyers" value={String(d.customers.returning)} hint={pctOf(d.customers.returning, d.customers.buyers) + " of buyers"} />
                <Stat label="Added to your list" value={String(d.customers.new_on_file)} hint="New customer records" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Top customers" sub="By amount bought" table={{ head: ["Customer", "Bought", "Orders", "Owes"], rows: d.customers.top.map((c) => [c.name, formatKobo(c.amount), c.orders, formatKobo(c.owes)]) }}>
                  <RankBars items={d.customers.top.slice(0, 10).map((c) => ({ label: c.name, value: c.amount, note: `${c.orders} orders${c.owes > 0 ? ` · owes ${formatKobo(c.owes)}` : ""}` }))} empty="No customer sales in this period." />
                </ChartCard>
                <ChartCard title="Top customers by orders" sub="Most orders placed" table={{ head: ["Customer", "Orders", "Bought"], rows: d.customers.top_orders.map((c) => [c.name, c.orders, formatKobo(c.amount)]) }}>
                  <RankBars kind="count" items={d.customers.top_orders.slice(0, 10).map((c) => ({ label: c.name, value: c.orders, note: formatKobo(c.amount) }))} empty="No customer sales in this period." />
                </ChartCard>
                <ChartCard title="Customers buying" value={String(d.customers.buyers)} sub={dl("customers")} table={{ head: ["Date", "Customers who bought"], rows: d.series.map((r) => [label(r.date, g), r.buyers]) }}>
                  <ColumnChart items={cols("buyers")} kind="count" name="Customers" />
                </ChartCard>
                <ChartCard title="New customers added" value={String(T.new_customers)} sub={dl("new_customers")} table={{ head: ["Date", "New customers"], rows: d.series.map((r) => [label(r.date, g), r.new_customers]) }}>
                  <ColumnChart items={cols("new_customers")} kind="count" name="New customers" />
                </ChartCard>
                <ChartCard title="Average spend per customer" value={formatKobo(T.avg_spend)} sub={dl("avg_spend")} table={{ head: ["Date", "Avg spend"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.avg_spend)]) }}>
                  <AreaChart points={pts("avg_spend")} name="Average spend" />
                </ChartCard>
                <ChartCard title="Customers vs walk-ins" sub="Sales to a named customer or to someone without a record">
                  <Donut items={[{ label: "Named customers", value: T.sales - d.customers.walk_in_amount }, { label: "Walk-ins", value: d.customers.walk_in_amount }]} centre="Sales" />
                  <p className="mt-3 text-xs text-ink-soft">{d.customers.walk_in_sales} walk-in sale{d.customers.walk_in_sales === 1 ? "" : "s"}. Recording customers lets you track who owes you and who buys often.</p>
                </ChartCard>
              </div>
            </div>
          )}

          {tab === "promos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Discount given" value={formatKobo(T.discount)} delta={dl("discount", false)} hint={pctOf(T.discount, T.sales + T.discount) + " of list value"} />
                <Stat label="Sales with a discount" value={String(d.discounts.sales_with_discount)} hint={`${d.discounts.share_of_sales}% of sales`} />
                <Stat label="Average discount" value={formatKobo(d.discounts.average_discount)} hint="On sales that had one" />
                <Stat label="Rebates earned" value={formatKobo(d.discounts.rebates.amount)} hint={`${d.discounts.rebates.count} calculation${d.discounts.rebates.count === 1 ? "" : "s"} ending in this period`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard wide title="Discount given over time" value={formatKobo(T.discount)} sub={dl("discount", false)} table={{ head: ["Date", "Discount"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.discount)]) }}>
                  <AreaChart points={pts("discount")} name="Discount" />
                </ChartCard>
                <ChartCard title="Discount by channel" table={{ head: ["Channel", "Discount", "Sales discounted"], rows: d.discounts.by_channel.map((c) => [CHANNELS[c.key] ?? cap(c.key), formatKobo(c.amount), c.count]) }}>
                  <Donut items={d.discounts.by_channel.map((c) => ({ label: CHANNELS[c.key] ?? cap(c.key), value: c.amount }))} centre="Discount" />
                </ChartCard>
                <ChartCard title="Most discounted products" sub="List price minus the price charged" table={{ head: ["Product", "Discount", "Units"], rows: d.discounts.top_products.map((p) => [p.name, formatKobo(p.discount), p.units]) }}>
                  <RankBars items={d.discounts.top_products.map((p) => ({ label: p.name, value: p.discount, note: `${p.units.toLocaleString("en-NG")} units` }))} empty="No product was sold below its list price." />
                </ChartCard>
                <ChartCard wide title="Manufacturer rebates" sub="Rebate calculations whose period ends in this range" table={{ head: ["Status", "Rebate", "Calculations"], rows: d.discounts.rebates.by_status.map((r) => [cap(r.key), formatKobo(r.amount), r.count]) }}>
                  <RankBars items={d.discounts.rebates.by_status.map((r) => ({ label: cap(r.key), value: r.amount, note: `${r.count} calculation${r.count === 1 ? "" : "s"}` }))} empty="No rebate calculations in this period." />
                </ChartCard>
              </div>
              <p className="text-xs text-ink-soft">Email and SMS campaigns are not part of the depot system yet, so this tab covers the promotions it does track: price promos, discounts and rebates.</p>
            </div>
          )}

          {tab === "profit" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Sales" value={formatKobo(T.sales)} delta={dl("sales")} />
                <Stat label="Gross profit" value={d.missing_cost ? "–" : formatKobo(T.gross_profit)} delta={d.missing_cost ? undefined : dl("gross_profit")} hint={d.missing_cost ? "Cost not recorded" : pctOf(T.gross_profit, T.sales) + " margin"} />
                <Stat label="Expenses" value={formatKobo(T.expenses)} delta={dl("expenses", false)} />
                <Stat label="Net profit" value={d.missing_cost ? "–" : formatKobo(T.net_profit)} delta={d.missing_cost ? undefined : dl("net_profit")} hint="Gross profit minus expenses" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard wide title="Expenses" value={formatKobo(T.expenses)} sub={dl("expenses", false)} table={{ head: ["Date", "Expenses"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.expenses)]) }}>
                  <AreaChart points={pts("expenses")} name="Expenses" />
                </ChartCard>
                {!d.missing_cost && (
                  <ChartCard wide title="Gross profit" value={formatKobo(T.gross_profit)} sub={dl("gross_profit")} table={{ head: ["Date", "Gross profit"], rows: d.series.map((r) => [label(r.date, g), formatKobo(r.gross_profit)]) }}>
                    <AreaChart points={pts("gross_profit")} name="Gross profit" />
                  </ChartCard>
                )}
                <ChartCard title="Where the money goes" sub="Expenses by category" table={{ head: ["Category", "Amount", "Count"], rows: d.expenses_by_category.map((c) => [c.name, formatKobo(c.amount), c.count]) }}>
                  <Donut items={d.expenses_by_category.map((c) => ({ label: c.name, value: c.amount }))} centre="Expenses" />
                </ChartCard>
                {d.by_branch.length > 1 && (
                  <ChartCard title="Branch: sales and expenses" table={{ head: ["Branch", "Sales", "Expenses"], rows: d.by_branch.map((b) => [b.name, formatKobo(b.amount), formatKobo(b.expenses)]) }}>
                    <RankBars items={d.by_branch.map((b) => ({ label: b.name, value: b.amount, note: `Expenses ${formatKobo(b.expenses)}` }))} />
                  </ChartCard>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
