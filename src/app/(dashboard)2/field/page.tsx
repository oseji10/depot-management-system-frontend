"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { IssueStockModal } from "../../../components/issue-stock-modal";
import { RepModal } from "../../../components/rep-modal";
import { RoutesModal } from "../../../components/routes-modal";
import { Badge, Button, ICON, PageHeader, Stat, Svg, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatKobo, formatTime, nairaToKobo, relativeDay } from "../../../lib/format";
import type { Rep } from "../../../lib/types";

export default function FieldPage() {
  const s = useSession();
  const [adding, setAdding] = useState(false);
  const [routing, setRouting] = useState<Rep | null>(null);
  const [issuing, setIssuing] = useState<Rep | "any" | null>(null);

  const qc = useQueryClient();
  const payroll = useMutation({
    mutationFn: (v: { user_id: number; basic_salary: number }) => api("/employees/from-user", { method: "POST", body: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reps"] }); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => window.alert((e as Error).message),
  });
  const addToPayroll = (r: Rep) => {
    const pay = window.prompt(`Monthly basic salary for ${r.name} (₦)`);
    const kobo = nairaToKobo(pay ?? "");
    if (kobo > 0) payroll.mutate({ user_id: r.id, basic_salary: kobo });
  };

  // Refreshes by itself so the manager can leave it open and watch the day unfold.
  const reps = useQuery({ queryKey: ["reps"], queryFn: () => api<Rep[]>("/reps"), refetchInterval: 20_000 });

  const list = reps.data ?? [];
  const onRoad = list.filter((r) => r.open_trip);
  const soldToday = list.reduce((n, r) => n + r.sold_today, 0);
  const unitsOut = onRoad.reduce((n, r) => n + r.units_on_van, 0);
  const manage = s.can("trips.manage");

  return (
    <>
      <PageHeader
        title="Salespeople"
        description="Issue stock to your drivers and salespeople, watch their sales as they happen, and check them in when they are back."
        action={manage && (
          <div className="flex flex-wrap gap-2">
            {s.can("users.create") && <Button variant="secondary" onClick={() => setAdding(true)}><Svg d={ICON.plus} /> New salesperson</Button>}
            <Button onClick={() => setIssuing("any")} disabled={!list.some((r) => r.is_active)}><Svg d={ICON.box} /> Issue stock</Button>
          </div>
        )}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="On the road" value={reps.isLoading ? "…" : onRoad.length} icon={ICON.people} note={list.length ? `of ${list.length} salesperson${list.length === 1 ? "" : "s"}` : undefined} />
        <Stat label="Sold today" value={reps.isLoading ? "…" : formatKobo(soldToday)} icon={ICON.trend} tone="blue" note="By all salespeople" />
        <Stat label="Stock out on vans" value={reps.isLoading ? "…" : unitsOut.toLocaleString("en-NG")} icon={ICON.box} tone="amber" note="Units still to sell or return" />
      </div>

      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Salesperson</th>
            <th scope="col" className={thClass}>Status</th>
            <th scope="col" className={`${thClass} text-right`}>On the van</th>
            <th scope="col" className={`${thClass} text-right`}>Sold today</th>
            <th scope="col" className={`${thClass} text-right`}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {reps.isLoading ? <TableLoading cols={5} /> : reps.error ? <TableError cols={5} message={(reps.error as Error).message} /> : list.length === 0 ? (
            <TableEmpty cols={5} icon={ICON.people} title="No salespeople yet" hint={manage ? "Add one to give them a login and a van." : "Ask a manager to add your salespeople."} />
          ) : list.map((r) => (
            <tr key={r.id} className="transition hover:bg-[#fff5f5]">
              <td className="px-5 py-3.5">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-ink-soft">{[r.phone, r.branch?.name].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-ink-soft">{r.routes?.length ? `Routes: ${r.routes.map((x) => x.name).join(", ")}` : "All customers"}{manage && <button type="button" className="ml-2 font-semibold text-[#f40009] hover:underline" onClick={() => setRouting(r)}>Change</button>}</p>
                {r.employee ? <p className="text-xs text-ink-soft">On payroll · {r.employee.staff_no}</p>
                  : s.can("employees.manage") && <button type="button" className="text-xs font-semibold text-[#f40009] hover:underline" onClick={() => addToPayroll(r)}>Add to payroll</button>}
              </td>
              <td className="px-4 py-3.5">
                {!r.is_active ? <Badge tone="bad">Disabled</Badge> : r.open_trip ? (
                  <Link href={`/field/trips/view?id=${r.open_trip.id}`} className="inline-flex items-center gap-2 font-medium text-[#f40009] hover:underline">
                    <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff3b3f] opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-[#ff3b3f]" /></span>
                    On the road
                    <span className="text-xs font-normal text-ink-soft">since {relativeDay(r.open_trip.opened_at) === "Today" ? formatTime(r.open_trip.opened_at) : relativeDay(r.open_trip.opened_at)}</span>
                  </Link>
                ) : <span className="text-ink-soft">In the depot</span>}
                {r.open_trip && r.open_trip.device_pending > 0 && <span className="mt-1 block text-xs font-medium text-amber-700">{r.open_trip.device_pending} sale{r.open_trip.device_pending === 1 ? "" : "s"} waiting on their phone</span>}
                {r.open_trip?.device_seen_at && Date.now() - new Date(r.open_trip.device_seen_at).getTime() > 10 * 60_000 && <span className="mt-1 block text-xs text-ink-soft">Phone last heard from at {formatTime(r.open_trip.device_seen_at)}</span>}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums">{r.open_trip ? r.units_on_van.toLocaleString("en-NG") : "—"}</td>
              <td className="px-4 py-3.5 text-right">
                <p className="font-semibold tabular-nums">{formatKobo(r.sold_today)}</p>
                <p className="text-xs text-ink-soft">{r.orders_today} order{r.orders_today === 1 ? "" : "s"}</p>
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex justify-end gap-2">
                  {r.open_trip && <Link href={`/field/trips/view?id=${r.open_trip.id}`}><Button size="sm" variant="secondary">Open trip</Button></Link>}
                  {manage && r.is_active && <Button size="sm" variant={r.open_trip ? "ghost" : "primary"} onClick={() => setIssuing(r)}>{r.open_trip ? "Top up" : "Issue stock"}</Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {adding && <RepModal onClose={() => setAdding(false)} />}
      {routing && <RoutesModal rep={routing} onClose={() => setRouting(null)} />}
      {issuing && (
        <IssueStockModal
          rep={issuing === "any" ? undefined : issuing}
          reps={list.filter((r) => r.is_active)}
          onClose={() => setIssuing(null)}
        />
      )}
    </>
  );
}
