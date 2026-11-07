"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOptions } from "../hooks/options";
import { ApiError, api } from "../lib/api";
import { formatKobo, koboToInput, nairaToKobo } from "../lib/format";
import type { TripReport } from "../lib/types";
import { formatQty } from "../lib/units";
import { Button, ErrorNote, Modal, MoneyField, SelectField } from "./ui";

const box = "min-h-10 w-full rounded-lg border border-line bg-surface px-2 text-right text-sm";

/**
 * Welcome back. For every product still with the salesperson, count what came back in good condition and what is
 * damaged; anything not accounted for is written off as a shortage. Then record the cash handed over and close the trip.
 */
export function CheckInModal({ report, onClose }: { report: TripReport; onClose: () => void }) {
  const queryClient = useQueryClient();
  const warehouses = useOptions("/warehouses");
  const rows = report.lines.filter((l) => l.with_rep > 0);
  const expected = report.money.cash_expected ?? 0;

  const [to, setTo] = useState("");
  const [good, setGood] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((l) => [l.product_id, String(l.with_rep)])));
  const [bad, setBad] = useState<Record<number, string>>({});
  const [cash, setCash] = useState(koboToInput(expected));
  const imprest = report.imprest;
  const [back, setBack] = useState(koboToInput(Math.max(0, imprest.balance)));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [unsent, setUnsent] = useState(false); // the salesperson's phone still holds sales; the manager must confirm to close anyway
  const [confirmed, setConfirmed] = useState(false);
  const waiting = report.sync.pending + report.sync.issues;

  const warehouse = to || (warehouses.length === 1 ? String(warehouses[0].value) : "");
  const num = (v: string | undefined) => Math.max(0, Math.floor(Number(v) || 0));
  const missing = (l: (typeof rows)[number]) => l.with_rep - num(good[l.product_id]) - num(bad[l.product_id]);
  const over = rows.some((l) => missing(l) < 0);
  const shortUnits = rows.reduce((n, l) => n + Math.max(0, missing(l)), 0);
  const handed = nairaToKobo(cash);
  const variance = handed - expected;
  const returning = rows.some((l) => num(good[l.product_id]) + num(bad[l.product_id]) > 0);

  const save = useMutation({
    mutationFn: () => {
      const returns = rows.flatMap((l) => [
        { product_id: l.product_id, unit_id: l.base_unit_id, quantity: num(good[l.product_id]), status: "saleable" },
        { product_id: l.product_id, unit_id: l.base_unit_id, quantity: num(bad[l.product_id]), status: "damaged" },
      ]).filter((r) => r.quantity > 0);

      return api<TripReport>(`/trips/${report.trip.id}/check-in`, {
        method: "POST",
        body: { close: true, confirm_pending: confirmed, cash_handed_in: handed, ...(imprest.issued > 0 ? { imprest_returned: Math.max(0, imprest.balance) > 0 ? nairaToKobo(back) : 0 } : {}), note: note || null, ...(returns.length ? { to_warehouse_id: Number(warehouse), returns } : {}) },
      });
    },
    onSuccess: () => {
      for (const key of ["reps", "trips", "trip", "stock", "dashboard", "field", "sales-summary"]) queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.status === 409 && e.body?.code === "pending_sync") setUnsent(true);
      setErrors(e instanceof ApiError && e.status !== 409 ? (e.errors ?? {}) : {});
    },
  });

  const problem = unsent ? null : (Object.values(errors).flat()[0] ?? (save.error && !Object.keys(errors).length ? (save.error as Error).message : null));

  return (
    <Modal title={`Check in ${report.rep.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-5">
        {rows.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Count what is left on the van. Quantities are in {rows.every((r) => r.base_unit === rows[0].base_unit) && rows[0].base_unit ? `${rows[0].base_unit.toLowerCase()}s` : "single units (bottles, cans)"}.</p>
            <div className="divide-y divide-line rounded-xl border border-line">
              {rows.map((l) => {
                const m = missing(l);
                return (
                  <div key={l.product_id} className="grid gap-2 p-3 sm:grid-cols-[1fr_7rem_7rem] sm:items-end">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="text-xs text-ink-soft">With them: {formatQty(l.with_rep, l.base_unit, l.pack)}</p>
                      {m > 0 && <p className="mt-0.5 text-xs font-medium text-amber-700">{formatQty(m, l.base_unit, l.pack)} not accounted for</p>}
                      {m < 0 && <p role="alert" className="mt-0.5 text-xs font-medium text-[#c23a3a]">More than they were carrying</p>}
                    </div>
                    <label className="text-xs font-medium text-ink-soft">Good<input inputMode="numeric" value={good[l.product_id] ?? ""} onChange={(e) => setGood((g) => ({ ...g, [l.product_id]: e.target.value.replace(/\D/g, "") }))} className={`${box} mt-1`} /></label>
                    <label className="text-xs font-medium text-ink-soft">Damaged<input inputMode="numeric" value={bad[l.product_id] ?? ""} onChange={(e) => setBad((g) => ({ ...g, [l.product_id]: e.target.value.replace(/\D/g, "") }))} className={`${box} mt-1`} /></label>
                  </div>
                );
              })}
            </div>
            {returning && (
              <SelectField label="Put the stock back into" value={warehouse} onChange={setTo} error={errors.to_warehouse_id?.[0]} required
                options={[{ value: "", label: "Choose…" }, ...warehouses]} />
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-[#ffe9ea] px-4 py-3 text-sm text-[#a50006]">Everything that was loaded has been sold. Nothing to bring back.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-paper p-4">
            <p className="text-sm text-ink-soft">Cash they should hand in</p>
            <p className="mt-0.5 text-xl font-bold">{formatKobo(expected)}</p>
            <p className="mt-1 text-xs text-ink-soft">Transfers and card payments went straight to the bank, so they are not counted here. Expenses are not taken off; they were paid from the imprest.</p>
          </div>
          <div>
            <MoneyField label="Cash handed in" value={cash} onChange={setCash} error={errors.cash_handed_in?.[0]} />
            <p className={`mt-1.5 text-xs font-medium ${variance === 0 ? "text-[#f40009]" : variance < 0 ? "text-[#c23a3a]" : "text-amber-700"}`}>
              {variance === 0 ? "Matches exactly." : variance < 0 ? `Short by ${formatKobo(-variance)}.` : `${formatKobo(variance)} more than expected.`}
            </p>
          </div>
        </div>

        {imprest.issued > 0 && (
          <div className="rounded-xl bg-paper p-4">
            <p className="text-sm text-ink-soft">Imprest · given {formatKobo(imprest.issued)} · spent {formatKobo(imprest.spent)}</p>
            {imprest.balance > 0 ? (
              <div className="mt-2 max-w-xs">
                <MoneyField label="Unspent imprest handed back" value={back} onChange={setBack} error={errors.imprest_returned?.[0]} />
                {nairaToKobo(back) < imprest.balance && <p className="mt-1.5 text-xs font-medium text-amber-700">{formatKobo(imprest.balance - nairaToKobo(back))} stays recorded as owed by the driver.</p>}
              </div>
            ) : imprest.balance < 0 ? (
              <p className="mt-1 text-sm font-semibold text-[#f40009]">The driver spent {formatKobo(-imprest.balance)} more than they were given. That amount is paid back to them when you close.</p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-[#f40009]">All of it was spent. Nothing to settle.</p>
            )}
          </div>
        )}

        {shortUnits > 0 && !over && (
          <ErrorNote>{shortUnits} unit{shortUnits === 1 ? "" : "s"} will be written off as a shortage at cost. Recount first if that does not look right.</ErrorNote>
        )}
        {(unsent || waiting > 0) && (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
            <p className="font-semibold">Not everything has reached the depot</p>
            <p className="mt-1">
              {report.sync.pending > 0 && <>{report.sync.pending} item{report.sync.pending === 1 ? " is" : "s are"} still on {report.rep.name.split(" ")[0]}&apos;s phone waiting for signal. </>}
              {report.sync.issues > 0 && <>{report.sync.issues} sale{report.sync.issues === 1 ? " was" : "s were"} turned down and need{report.sync.issues === 1 ? "s" : ""} your attention under Sync issues. </>}
              Closing now means those cannot be recorded against this trip, and the stock and cash above will not include them.
            </p>
            <label className="mt-3 flex items-start gap-2 font-medium"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4" /> Close the trip anyway</label>
          </div>
        )}
        {problem && <ErrorNote>{problem}</ErrorNote>}

        <label className="block text-sm font-medium">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-normal" placeholder="Anything worth remembering about this trip" />
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={over || (returning && !warehouse) || ((unsent || waiting > 0) && !confirmed)}>Check in and close trip</Button>
        </div>
      </form>
    </Modal>
  );
}
