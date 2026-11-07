"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "../hooks/session";
import { formatDateTime, formatKobo, formatTime } from "../lib/format";
import { PAYMENT_LABEL, PAYMENT_TONE } from "../lib/status";
import type { TripReport } from "../lib/types";
import { formatQty } from "../lib/units";
import { ImprestModal } from "./imprest-modal";
import { Badge, Button, Card, ICON, Stat, TableCard, theadClass, thClass } from "./ui";

/** The figures, stock table, sales feed and load history for one trip. Shared by the manager's page and the salesperson's home. */
export function TripView({ report, mine = false }: { report: TripReport; mine?: boolean }) {
  const { money: m, totals: t } = report;
  const s = useSession();
  const [giving, setGiving] = useState(false);
  const imp = report.imprest;
  const open = report.trip.status === "open";
  const q = (n: number, l: TripReport["lines"][number]) => formatQty(n, l.base_unit, l.pack);

  return (
    <div className="space-y-5">
      {(report.terminal || report.vehicle) && (
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          {report.terminal && <span>POS terminal: <strong className="text-ink">{report.terminal.name}</strong></span>}
          {report.vehicle && <span>Vehicle: <strong className="text-ink">{report.vehicle.nickname || report.vehicle.reg_no}</strong></span>}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sold so far" value={formatKobo(m.sales)} icon={ICON.trend} note={`${m.orders} order${m.orders === 1 ? "" : "s"}`} />
        <Stat label={mine ? "Cash you are holding" : open ? "Cash they should hold" : "Cash expected"} value={formatKobo(m.cash_expected ?? 0)} icon={ICON.cash} tone="blue" note={`Transfers ${formatKobo(m.transfer)} · Card ${formatKobo(m.pos)}`} />
        <Stat label="Sold on credit" value={formatKobo(m.on_credit)} icon={ICON.alert} tone={m.on_credit > 0 ? "amber" : "green"} note="Still to be collected from customers" />
        <Stat label={open ? "Still on the van" : "Left on the van"} value={t.with_rep.toLocaleString("en-NG")} icon={ICON.box} tone="amber" note={`${t.issued.toLocaleString("en-NG")} loaded · ${t.sold.toLocaleString("en-NG")} sold`} />
      </div>

      {!open && (
        <Card title="How the trip ended">
          <div className="grid gap-4 sm:grid-cols-4">
            <div><p className="text-sm text-ink-soft">Cash expected</p><p className="text-lg font-bold">{formatKobo(m.cash_expected ?? 0)}</p></div>
            <div><p className="text-sm text-ink-soft">Cash handed in</p><p className="text-lg font-bold">{formatKobo(m.cash_handed_in ?? 0)}</p></div>
            <div>
              <p className="text-sm text-ink-soft">Difference</p>
              <p className="text-lg font-bold">{m.cash_variance === 0 ? <Badge tone="good">Balanced</Badge> : <span className={(m.cash_variance ?? 0) < 0 ? "text-[#c23a3a]" : "text-amber-700"}>{(m.cash_variance ?? 0) < 0 ? "Short " : "Over "}{formatKobo(Math.abs(m.cash_variance ?? 0))}</span>}</p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Stock</p>
              <p className="text-sm">{t.returned.toLocaleString("en-NG")} back · {t.damaged.toLocaleString("en-NG")} damaged{t.shortage > 0 ? <> · <span className="font-semibold text-[#c23a3a]">{t.shortage.toLocaleString("en-NG")} missing</span></> : null}</p>
            </div>
          </div>
          {report.trip.close_note && <p className="mt-3 text-sm text-ink-soft">Note: {report.trip.close_note}</p>}
        </Card>
      )}

      {(imp.issued > 0 || (open && !mine && s.can("imprest.manage"))) && (
        <Card title="Imprest (running money)" action={open && !mine && s.can("imprest.manage") ? <Button size="sm" variant="secondary" onClick={() => setGiving(true)}>Give imprest</Button> : undefined}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-ink-soft">Given</p><p className="text-lg font-bold">{formatKobo(imp.issued)}</p></div>
            <div><p className="text-sm text-ink-soft">Spent</p><p className="text-lg font-bold">{formatKobo(imp.spent)}</p></div>
            <div><p className="text-sm text-ink-soft">{imp.balance < 0 ? "Overspent" : "Left"}</p><p className={`text-lg font-bold ${imp.balance < 0 ? "text-amber-700" : ""}`}>{formatKobo(Math.abs(imp.balance))}</p></div>
          </div>
          {!open && (imp.returned || imp.reimbursed || imp.unreturned) ? (
            <p className="mt-3 text-sm text-ink-soft">
              {imp.returned ? <>Handed back {formatKobo(imp.returned)}. </> : null}
              {imp.reimbursed ? <>Paid back to the driver {formatKobo(imp.reimbursed)}. </> : null}
              {imp.unreturned ? <span className="font-semibold text-[#c23a3a]">{formatKobo(imp.unreturned)} not handed back, still owed by the driver.</span> : null}
            </p>
          ) : null}
          {imp.items.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {imp.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{i.number} · {formatDateTime(i.at)}{i.by ? ` · ${i.by}` : ""}{i.note ? ` · ${i.note}` : ""}</span>
                  <span className={`font-semibold tabular-nums ${i.status === "void" ? "text-ink-soft line-through" : ""}`}>{formatKobo(i.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {giving && <ImprestModal tripId={report.trip.id} driver={report.rep.name} onClose={() => setGiving(false)} />}

      <TableCard min={open ? "0px" : "44rem"}>
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Product</th>
            <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>Loaded</th>
            <th scope="col" className={`${thClass} text-right`}>Sold</th>
            <th scope="col" className={`${thClass} text-right`}>{open ? "On the van" : "Left"}</th>
            {!open && <th scope="col" className={`${thClass} text-right`}>Came back</th>}
            {!open && <th scope="col" className={`${thClass} text-right`}>Damaged / missing</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.lines.map((l) => (
            <tr key={l.product_id}>
              <td className="px-5 py-3"><p className="font-medium">{l.name}</p><p className="text-xs text-ink-soft">{l.sku}</p></td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{q(l.issued, l)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{q(l.sold, l)}<p className="text-xs text-ink-soft">{formatKobo(l.revenue)}</p></td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${l.with_rep > 0 && open ? "text-[#f40009]" : ""}`}>{q(l.with_rep, l)}</td>
              {!open && <td className="px-4 py-3 text-right tabular-nums">{q(l.returned, l)}</td>}
              {!open && <td className="px-4 py-3 text-right tabular-nums">{l.damaged + l.shortage === 0 ? "—" : <span className="text-[#c23a3a]">{l.damaged > 0 && `${q(l.damaged, l)} damaged`}{l.damaged > 0 && l.shortage > 0 && " · "}{l.shortage > 0 && `${q(l.shortage, l)} missing`}</span>}</td>}
            </tr>
          ))}
        </tbody>
      </TableCard>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={open ? "Sales so far" : "Sales on this trip"}>
          {report.sales.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">No sales yet.</p> : (
            <ul className="divide-y divide-line">
              {report.sales.map((x) => (
                <li key={x.id}>
                  <Link href={`/sales/view?id=${x.id}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-[#f40009]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{x.number} <span className="font-normal text-ink-soft">· {formatTime(x.sold_at)}</span></span>
                      <span className="block truncate text-xs text-ink-soft">{x.customer ?? "Walk-in customer"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">{formatKobo(x.total)}</span>
                      {x.status === "void" ? <Badge tone="bad">Void</Badge> : <Badge tone={PAYMENT_TONE[x.payment_status]}>{PAYMENT_LABEL[x.payment_status]}</Badge>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {report.expenses.length > 0 && (
          <Card title={mine ? "Your expenses" : "Expenses on this trip"} className="lg:col-span-2">
            <ul className="divide-y divide-line">
              {report.expenses.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{x.category}{x.paid_to ? <span className="font-normal text-ink-soft"> · {x.paid_to}</span> : null}</span>
                    <span className="block truncate text-xs text-ink-soft">{x.number} · {x.method === "imprest" ? "paid from imprest" : x.method === "cash" ? "paid in cash" : "paid from the bank"}{x.description ? ` · ${x.description}` : ""}</span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${x.status === "void" ? "text-ink-soft line-through" : ""}`}>{formatKobo(x.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Stock movements">
          <ol className="space-y-4">
            {report.loads.map((l) => (
              <li key={l.id} className="text-sm">
                <p className="font-semibold">{l.kind === "issue" ? "Loaded onto the van" : "Came off the van"} <span className="font-normal text-ink-soft">· {formatDateTime(l.at)}</span></p>
                <p className="text-xs text-ink-soft">{l.kind === "issue" ? "From" : "To"} {l.warehouse}{l.by ? ` · by ${l.by}` : ""}</p>
                <ul className="mt-1 text-ink-soft">
                  {l.lines.map((x, i) => <li key={i}>{x.quantity.toLocaleString("en-NG")} × {x.product}{x.status !== "saleable" ? ` (${x.status})` : ""}</li>)}
                </ul>
                {l.note && <p className="mt-1 text-xs italic text-ink-soft">“{l.note}”</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
