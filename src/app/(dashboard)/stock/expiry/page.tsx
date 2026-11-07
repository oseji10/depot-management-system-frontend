"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, PageHeader, Stat, TableEmpty, TableError, TableLoading } from "../../../../components/ui";
import { useOptions } from "../../../../hooks/options";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import type { ExpiryBatch, ExpiryReport } from "../../../../lib/types";

const selectClass = "min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm focus:border-[#ff3b3f] focus:outline-none focus:ring-4 focus:ring-[#ff3b3f]/15";
const STATES = [
  { value: "attention", label: "Needs attention" },
  { value: "expired", label: "Expired" },
  { value: "soon", label: "Expiring soon" },
  { value: "all", label: "All batches" },
] as const;

const when = (b: ExpiryBatch) =>
  b.days_left < 0 ? `${-b.days_left} day${b.days_left === -1 ? "" : "s"} ago` : b.days_left === 0 ? "Today" : `in ${b.days_left} day${b.days_left === 1 ? "" : "s"}`;

export default function ExpiryPage() {
  const s = useSession();
  const qc = useQueryClient();
  const warehouses = useOptions("/warehouses");
  const [state, setState] = useState<(typeof STATES)[number]["value"]>("attention");
  const [warehouseId, setWarehouseId] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [dating, setDating] = useState<ExpiryReport["untracked"][number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const report = useQuery({
    queryKey: ["expiry", state, warehouseId],
    queryFn: () => api<ExpiryReport>(`/stock/expiry?state=${state}${warehouseId ? `&warehouse_id=${warehouseId}` : ""}`),
  });

  const rows = report.data?.data ?? [];
  const expiredRows = rows.filter((r) => r.state === "expired");
  const sameWarehouse = new Set(rows.filter((r) => picked.includes(r.id)).map((r) => r.warehouse.id)).size <= 1;

  const writeOff = useMutation({
    mutationFn: () => api<{ number: string }>("/stock/expiry/write-off", { method: "POST", body: { batch_ids: picked } }),
    onSuccess: (a) => {
      setPicked([]);
      setNotice(`Write-off ${a.number} raised. Stock leaves once a manager approves it under Adjustments.`);
      void qc.invalidateQueries({ queryKey: ["expiry"] });
    },
  });

  const th = "px-4 py-2.5 font-medium";
  const canAdjust = s.can("inventory.adjust");

  return (
    <>
      <PageHeader
        title="Expiry dates"
        description="Stock of expiry-tracked products by batch. The oldest batch sells first, and expired stock cannot be sold."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expired units" value={String(report.data?.summary.expired_units ?? "–")} note={`${report.data?.summary.expired_batches ?? 0} batches`} />
        <Stat label="Expiring soon" value={String(report.data?.summary.soon_units ?? "–")} note={`${report.data?.summary.soon_batches ?? 0} batches`} />
        <Stat label="No date on record" value={String(report.data?.summary.untracked_products ?? "–")} note="products to date" />
      </div>

      {notice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="inline-flex rounded-xl border border-line bg-surface p-1 text-sm shadow-sm">
          {STATES.map((o) => (
            <button key={o.value} role="tab" aria-selected={state === o.value} onClick={() => { setState(o.value); setPicked([]); }}
              className={`rounded-lg px-3 py-2 ${state === o.value ? "bg-gradient-to-b from-[#ff3b3f] to-[#f40009] font-semibold text-white shadow-sm" : "text-ink-soft"}`}>{o.label}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="ex-wh">Warehouse</label>
        <select id="ex-wh" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPicked([]); }} className={selectClass}>
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        {canAdjust && (
          <Button variant="secondary" disabled={!expiredRows.length} onClick={() => setPicked(expiredRows.map((r) => r.id))}>Select all expired</Button>
        )}
        {canAdjust && picked.length > 0 && (
          <Button variant="danger" busy={writeOff.isPending} disabled={!sameWarehouse} onClick={() => { setNotice(null); writeOff.mutate(); }}>
            Write off {picked.length} batch{picked.length === 1 ? "" : "es"}
          </Button>
        )}
      </div>
      {picked.length > 0 && !sameWarehouse && <ErrorNote>Pick batches from one warehouse at a time.</ErrorNote>}
      {writeOff.error && <ErrorNote>{(writeOff.error as Error).message}</ErrorNote>}

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              {canAdjust && <th scope="col" className={`${th} w-10`}><span className="sr-only">Select</span></th>}
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={th}>Warehouse</th>
              <th scope="col" className={th}>Batch</th>
              <th scope="col" className={th}>Expires</th>
              <th scope="col" className={`${th} text-right`}>Units</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {report.isLoading ? <TableLoading cols={7} />
              : report.error ? <TableError cols={7} message={(report.error as Error).message} />
              : rows.length === 0 ? <TableEmpty cols={7} title="Nothing here" hint={state === "attention" ? "No batches are expired or close to expiring." : "No batches recorded yet. Tick “Track expiry dates” on a product and enter the date when you receive it."} />
              : rows.map((r) => (
                <tr key={r.id} className={r.state === "expired" ? "bg-red-50/50" : ""}>
                  {canAdjust && (
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${r.product.name} ${r.batch_no}`} className="size-4 accent-[#f40009]" checked={picked.includes(r.id)}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
                    </td>
                  )}
                  <td className="px-4 py-3"><p className="font-medium">{r.product.name}</p><p className="text-xs text-ink-soft">{r.product.sku}</p></td>
                  <td className="px-4 py-3">{r.warehouse.name}</td>
                  <td className="px-4 py-3">{r.batch_no || <span className="text-ink-soft">–</span>}</td>
                  <td className="px-4 py-3">{r.expiry_date}<p className="text-xs text-ink-soft">{when(r)}</p></td>
                  <td className="px-4 py-3 text-right font-medium">{r.quantity}</td>
                  <td className="px-4 py-3"><Badge tone={r.state === "expired" ? "bad" : r.state === "soon" ? "warn" : "good"}>{r.state === "expired" ? "Expired" : r.state === "soon" ? "Expiring soon" : "In date"}</Badge></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {(report.data?.untracked.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-base font-bold">Stock with no expiry date</h2>
          <p className="mb-3 text-sm text-ink-soft">These units were in the warehouse before tracking began, or were added without a date. Give them a date so they show up above.</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm">
            {report.data!.untracked.map((u) => (
              <li key={`${u.warehouse.id}-${u.product.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span><span className="font-medium">{u.product.name}</span> <span className="text-sm text-ink-soft">· {u.warehouse.name} · {u.quantity} units</span></span>
                {canAdjust && <Button size="sm" variant="secondary" onClick={() => setDating(u)}>Add date</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dating && <AssignModal row={dating} onClose={() => setDating(null)} />}
    </>
  );
}

function AssignModal({ row, onClose }: { row: ExpiryReport["untracked"][number]; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState(String(row.quantity));
  const [expiry, setExpiry] = useState("");
  const [batch, setBatch] = useState("");

  const save = useMutation({
    mutationFn: () => api("/stock/expiry/assign", {
      method: "POST",
      body: { warehouse_id: row.warehouse.id, product_id: row.product.id, quantity: Number(qty), expiry_date: expiry, batch_no: batch || null },
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["expiry"] }); onClose(); },
  });

  return (
    <Modal title={`Add expiry date · ${row.product.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">{row.quantity} units in {row.warehouse.name} have no date. Enter how many share this date; repeat for other dates.</p>
        <Field label="Units with this date" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))} required />
        <Field label="Expiry date" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
        <Field label="Batch number (optional)" value={batch} onChange={(e) => setBatch(e.target.value)} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!expiry || !Number(qty) || Number(qty) > row.quantity}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
