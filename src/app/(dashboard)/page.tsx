"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BarChart, Button, Card, ICON, PageHeader, Stat, Svg } from "../../components/ui";
import { MyVanHome } from "../../components/my-van";
import { useSession } from "../../hooks/session";
import { api } from "../../lib/api";
import { formatDate, formatKobo } from "../../lib/format";
import type { DashboardSummary } from "../../lib/types";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const naira = (kobo: number) => formatKobo(kobo);

export default function DashboardPage() {
  const s = useSession();
  return s.van ? <MyVanHome /> : <ManagerDashboard />;
}

function ManagerDashboard() {
  const s = useSession();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardSummary>("/dashboard/summary") });
  const sales = data?.sales;

  const actions = [
    { href: "/pos", label: "New sale", hint: "Open the till", icon: ICON.cart, show: s.can("sales.create") },
    { href: "/goods-receipts/new", label: "Receive goods", hint: "Record a delivery", icon: ICON.box, show: s.can("goods-receipts.record") },
    { href: "/field", label: "Van Salesmen", hint: "Issue stock, watch trips", icon: ICON.people, show: s.can("trips.view") },
    { href: "/customers", label: "Customers", hint: "Balances and credit", icon: ICON.people, show: s.can("customers.view") },
    { href: "/stock", label: "Stock on hand", hint: "See what is on the shelf", icon: ICON.doc, show: s.can("inventory.view") },
  ].filter((a) => a.show);

  const attention = [
    data?.sync_issues ? { href: "/field/issues", tone: "rose", text: `${data.sync_issues} sale${data.sync_issues === 1 ? "" : "s"} or expense${data.sync_issues === 1 ? "" : "s"} from the field could not be recorded` } : null,
    data?.on_road ? { href: "/field", tone: "green", text: `${data.on_road} van ${data.on_road === 1 ? "salesman is" : "salesmen are"} on the road right now` } : null,
    data?.low_stock ? { href: "/stock", tone: "amber", text: `${data.low_stock} product${data.low_stock === 1 ? " is" : "s are"} below the reorder level` } : null,
    sales?.unpaid_orders ? { href: "/sales", tone: "rose", text: `${sales.unpaid_orders} unpaid order${sales.unpaid_orders === 1 ? "" : "s"} · ${naira(sales.outstanding)} owed to you` } : null,
  ].filter((x): x is { href: string; tone: string; text: string } => !!x);

  const org = [
    { label: "Stores", value: data?.stores, href: "/stores", show: s.isPlatform },
    { label: "Branches", value: data?.branches, href: "/branches", show: s.can("branches.view") },
    { label: "Warehouses", value: data?.warehouses, href: "/warehouses", show: s.can("warehouses.view") },
    { label: "Active users", value: data?.users, href: "/users", show: s.can("users.view") },
  ].filter((t) => t.show);

  return (
    <>
      <PageHeader
        crumb={new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting()}, ${s.user.name.split(" ")[0]}`}
        description={
          s.level === "platform"
            ? "You are viewing the whole platform. Pick a store in the sidebar to focus on one depot."
            : s.level === "store"
              ? `Showing every branch of ${s.store?.name}.`
              : `Showing ${s.branch?.name} only.`
        }
        action={s.can("sales.create") && <Link href="/pos"><Button><Svg d={ICON.cart} /> New sale</Button></Link>}
      />

      {s.can("sales.view") && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Sales today" value={sales ? naira(sales.today.total) : "…"} icon={ICON.trend} note={sales ? `${sales.today.orders} order${sales.today.orders === 1 ? "" : "s"}` : undefined} href="/sales" />
          <Stat label="Sales this month" value={sales ? naira(sales.month.total) : "…"} icon={ICON.cash} tone="blue" note={sales ? `${sales.month.orders} order${sales.month.orders === 1 ? "" : "s"}` : undefined} href="/sales" />
          <Stat label="Owed by customers" value={sales ? naira(sales.outstanding) : "…"} icon={ICON.alert} tone={sales && sales.outstanding > 0 ? "amber" : "green"} note={sales ? `${sales.unpaid_orders} unpaid order${sales.unpaid_orders === 1 ? "" : "s"}` : undefined} href="/customers" />
          {data?.low_stock !== null && <Stat label="Low stock" value={data?.low_stock ?? "…"} icon={ICON.box} tone={data?.low_stock ? "rose" : "green"} note={data?.low_stock ? "Needs reordering" : "Everything is stocked"} href="/stock" />}
        </div>
      )}

      {sales && (
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title="Last 14 days">
            <BarChart format={naira} points={sales.daily.map((d) => ({ label: new Date(`${d.date}T00:00:00`).getDate().toString(), value: d.total, hint: formatDate(d.date) }))} />
          </Card>
          <Card title="Best sellers this month">
            {sales.top_products.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">Sales will show up here as you make them.</p>
            ) : (
              <ol className="space-y-3">
                {sales.top_products.map((p, i) => {
                  const top = sales.top_products[0].revenue || 1;
                  return (
                    <li key={p.product_id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2.5"><span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#ffe9ea] text-xs font-bold text-[#f40009]">{i + 1}</span><span className="truncate font-medium">{p.name}</span></span>
                        <span className="shrink-0 font-semibold">{naira(p.revenue)}</span>
                      </div>
                      <div className="mt-1.5 ml-[2.1rem] h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-gradient-to-r from-[#ff3b3f] to-[#ff7a7d]" style={{ width: `${(p.revenue / top) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {attention.length > 0 && (
          <Card title="Needs your attention">
            <ul className="space-y-2">
              {attention.map((a) => (
                <li key={a.text}>
                  <Link href={a.href} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${a.tone === "amber" ? "bg-amber-50 text-amber-800 hover:bg-amber-100" : a.tone === "green" ? "bg-[#ffe9ea] text-[#a50006] hover:bg-[#ffd3d4]" : "bg-rose-50 text-rose-800 hover:bg-rose-100"}`}>
                    {a.text}<Svg d={ICON.right} className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {actions.length > 0 && (
          <Card title="Quick actions" className={attention.length === 0 ? "lg:col-span-2" : ""}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {actions.map((a) => (
                <Link key={a.href} href={a.href} className="group flex items-center gap-3.5 rounded-xl border border-line p-3.5 transition hover:border-[#ff3b3f]/50 hover:bg-[#fff5f5]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffe9ea] text-[#f40009] transition group-hover:bg-[#f40009] group-hover:text-white"><Svg d={a.icon} className="size-5" /></span>
                  <span><span className="block text-sm font-semibold">{a.label}</span><span className="block text-xs text-ink-soft">{a.hint}</span></span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>

      {org.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {org.map((t) => (
            <Link key={t.label} href={t.href} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm transition hover:border-[#ff3b3f]/40 hover:shadow-md">
              <span className="text-sm text-ink-soft">{t.label}</span>
              {isLoading ? <span className="h-6 w-8 animate-pulse rounded bg-line" /> : <span className="text-2xl font-bold tracking-tight">{t.value ?? 0}</span>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
