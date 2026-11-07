"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "../hooks/session";
import { api } from "../lib/api";
import { formatKobo } from "../lib/format";
import { ExpenseModal } from "./expense-modal";
import { useOffline } from "./offline-provider";
import type { MyVan } from "../lib/types";
import { Button, Card, ICON, PageHeader, Svg } from "./ui";
import { TripView } from "./trip-view";
import { MyTargets } from "./my-targets";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** A salesperson's home: what is on their van, what they have sold, and the cash they are holding. */
export function MyVanHome() {
  const s = useSession();
  const me = useQuery({ queryKey: ["field", "me"], queryFn: () => api<MyVan>("/field/me"), refetchInterval: 20_000 });
  const report = me.data?.report;
  const offline = useOffline();
  const [expense, setExpense] = useState(false);
  const snap = offline?.snapshot;
  // With no signal the live report is out of reach; show what the phone itself knows.
  const local = !!me.error && !!snap;
  const salesQueued = (offline?.queue ?? []).filter((q) => q.kind === "sale");

  return (
    <>
      <PageHeader
        crumb={new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting()}, ${s.user.name.split(" ")[0]}`}
        description={report ? `${report.van.name} · trip ${report.trip.number}` : local && snap?.trip ? `${snap.van.name} · trip ${snap.trip.number}` : s.van?.name}
        action={(report || (local && snap?.trip)) && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setExpense(true)}><Svg d={ICON.cash} /> Log expense</Button>
            <Link href="/pos"><Button><Svg d={ICON.cart} /> Start selling</Button></Link>
          </div>
        )}
      />

      {expense && <ExpenseModal onClose={() => setExpense(false)} />}
      <MyTargets />

      {me.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
      ) : local && snap ? (
        <div className="space-y-5">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
            No signal. This is what your phone knows: stock from your last download, less the sales you have made since.
          </p>
          {salesQueued.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card><p className="text-sm text-ink-soft">Sold on this phone</p><p className="text-2xl font-bold">{formatKobo(salesQueued.reduce((n, q) => n + q.summary.total, 0))}</p><p className="text-xs text-ink-soft">{salesQueued.length} sale{salesQueued.length === 1 ? "" : "s"}, {salesQueued.filter((q) => q.status === "pending").length} not sent yet</p></Card>
              <Card><p className="text-sm text-ink-soft">Cash taken on this phone</p><p className="text-2xl font-bold">{formatKobo(salesQueued.reduce((n, q) => n + ((q.data.payments as { method: string; amount: number }[] | undefined) ?? []).filter((p) => p.method === "cash").reduce((m, p) => m + p.amount, 0), 0))}</p><p className="text-xs text-ink-soft">Before expenses</p></Card>
            </div>
          )}
          <Card title="Still on your van">
            <ul className="divide-y divide-line">
              {snap.catalogue.products.filter((p) => offline!.stockOf(p.id) > 0).map((p) => {
                const n = offline!.stockOf(p.id);
                const big = p.units[p.units.length - 1];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                    <span className="shrink-0 tabular-nums">{n.toLocaleString("en-NG")}{big && big.factor > 1 && n >= big.factor ? <span className="text-ink-soft"> · {Math.floor(n / big.factor)} {big.name}</span> : null}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : me.error ? (
        <p className="text-sm text-[#c23a3a]">{(me.error as Error).message}</p>
      ) : !report ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]"><Svg d={ICON.box} className="size-7" /></span>
          <p className="mt-4 font-semibold">Nothing on your van yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">When the warehouse issues your stock it appears here, and you can start selling.</p>
        </div>
      ) : (
        <TripView report={report} mine />
      )}
    </>
  );
}
