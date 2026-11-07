"use client";

import { StagedFiles, uploadReceiptFile } from "./receipt-files";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOptions } from "../hooks/options";
import { ApiError, api } from "../lib/api";
import { formatNaira } from "../lib/format";
import type { GoodsReceipt, Product } from "../lib/types";
import { biggestUnit } from "./lines-editor";
import { ProductPicker } from "./product-picker";
import { Button, Field, SelectField } from "./ui";

export type ReceiptLineState = {
  poLineId: number | null; // set when the line comes from a purchase order: product and unit are then fixed
  product: { id: number; name: string; sku: string } | Product | null;
  unitId: string;
  unitName: string;
  factor: number;
  delivered: string;
  damaged: string;
  rejected: string;
  reason: string;
  cost: string;
  batchNo: string;
  expiry: string;
};

export type ReceiptInitial = {
  receiptId?: number;
  poId: number | null;
  poNumber?: string;
  supplierId: string;
  warehouseId: string;
  reference: string;
  receivedOn: string;
  vehicle: string;
  note: string;
  lines: ReceiptLineState[];
};

const blankLine = (): ReceiptLineState => ({
  poLineId: null, product: null, unitId: "", unitName: "", factor: 1, delivered: "", damaged: "", rejected: "", reason: "", cost: "", batchNo: "", expiry: "",
});

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const emptyReceipt = (): ReceiptInitial => ({
  poId: null, supplierId: "", warehouseId: "", reference: "", receivedOn: todayIso(), vehicle: "", note: "", lines: [blankLine()],
});

/** Turn a saved draft back into form state. */
export function receiptToInitial(r: GoodsReceipt): ReceiptInitial {
  return {
    receiptId: r.id,
    poId: r.purchase_order_id,
    poNumber: r.purchase_order?.number,
    supplierId: String(r.supplier_id),
    warehouseId: String(r.warehouse_id),
    reference: r.supplier_reference ?? "",
    receivedOn: r.received_on,
    vehicle: r.vehicle_no ?? "",
    note: r.note ?? "",
    lines: (r.lines ?? []).map((l) => ({
      poLineId: l.purchase_order_line_id,
      product: l.product ?? null,
      unitId: String(l.unit_id),
      unitName: l.unit?.name ?? "",
      factor: l.factor,
      delivered: String(l.delivered),
      damaged: l.damaged ? String(l.damaged) : "",
      rejected: l.rejected ? String(l.rejected) : "",
      reason: l.reason ?? "",
      cost: String(Number(l.unit_cost)),
      batchNo: l.batch_no ?? "",
      expiry: l.expiry_date ?? "",
    })),
  };
}

const int = (v: string) => (v === "" ? 0 : Number(v));
const digits = (v: string) => v.replace(/[^\d]/g, "");

export function ReceiptForm({ initial }: { initial: ReceiptInitial }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const suppliers = useOptions("/suppliers");
  const warehouses = useOptions("/warehouses");

  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [staged, setStaged] = useState<File[]>([]);

  const set = <K extends keyof ReceiptInitial>(key: K, value: ReceiptInitial[K]) => setV((s) => ({ ...s, [key]: value }));
  const patch = (i: number, p: Partial<ReceiptLineState>) => setV((s) => ({ ...s, lines: s.lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)) }));

  const accepted = (l: ReceiptLineState) => int(l.delivered) - int(l.damaged) - int(l.rejected);
  const tracked = (l: ReceiptLineState) => !!(l.product as { tracks_expiry?: boolean } | null)?.tracks_expiry;
  const lineOk = (l: ReceiptLineState) => !!l.product && int(l.delivered) > 0 && accepted(l) >= 0 && l.cost !== "" && (int(l.damaged) + int(l.rejected) === 0 || l.reason.trim() !== "") && (!tracked(l) || accepted(l) === 0 || l.expiry !== "");
  const complete = !!v.supplierId && !!v.warehouseId && v.lines.length > 0 && v.lines.every(lineOk);
  const value = v.lines.reduce((sum, l) => sum + Math.max(0, accepted(l)) * Number(l.cost || 0), 0);
  const locked = v.poId !== null; // a receipt against an order keeps that order's supplier

  const save = useMutation({
    mutationFn: () => {
      const body = {
        supplier_id: Number(v.supplierId), warehouse_id: Number(v.warehouseId), purchase_order_id: v.poId,
        supplier_reference: v.reference || null, received_on: v.receivedOn, vehicle_no: v.vehicle || null, note: v.note || null,
        lines: v.lines.map((l) => ({
          purchase_order_line_id: l.poLineId, product_id: l.product!.id, unit_id: Number(l.unitId),
          delivered: int(l.delivered), damaged: int(l.damaged), rejected: int(l.rejected), unit_cost: Number(l.cost), reason: l.reason || null,
          batch_no: tracked(l) ? l.batchNo || null : null, expiry_date: tracked(l) && l.expiry ? l.expiry : null,
        })),
      };
      return v.receiptId
        ? api<GoodsReceipt>(`/goods-receipts/${v.receiptId}`, { method: "PUT", body })
        : api<GoodsReceipt>("/goods-receipts", { method: "POST", body });
    },
    onSuccess: async (r) => {
      // The receipt is saved; now attach the invoice photos / PDFs. A failed upload does not undo the receipt.
      const failed: string[] = [];
      for (const f of staged) {
        try { await uploadReceiptFile(r.id, f); } catch (e) { failed.push(`${f.name}: ${(e as Error).message}`); }
      }
      if (failed.length) window.alert(`The receipt was saved, but these files could not be attached. Add them from the receipt page.\n\n${failed.join("\n")}`);
      queryClient.invalidateQueries({ queryKey: ["list", "/goods-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["goods-receipt", String(r.id)] });
      router.push(`/goods-receipts/view?id=${r.id}`);
    },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  const num = "min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-right text-sm";

  return (
    <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface shadow-sm p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Supplier" value={v.supplierId} onChange={(x) => set("supplierId", x)} required
            options={[{ value: "", label: "Select a supplier" }, ...suppliers.filter((s) => !locked || String(s.value) === v.supplierId)]} error={errors.supplier_id?.[0]} />
          <SelectField label="Receive into" value={v.warehouseId} onChange={(x) => set("warehouseId", x)} required
            options={[{ value: "", label: "Select a warehouse" }, ...warehouses]} error={errors.warehouse_id?.[0]} />
          <Field label="Supplier delivery note or invoice number" value={v.reference} onChange={(e) => set("reference", e.target.value)}
            hint="Each supplier document can only be recorded once." error={errors.supplier_reference?.[0]} />
          <Field label="Received on" type="date" value={v.receivedOn} onChange={(e) => set("receivedOn", e.target.value)} error={errors.received_on?.[0]} required />
          <Field label="Truck / vehicle number" value={v.vehicle} onChange={(e) => set("vehicle", e.target.value)} />
          <Field label="Note" value={v.note} onChange={(e) => set("note", e.target.value)} />
        </div>
        {v.poNumber && <p className="mt-3 text-sm text-ink-soft">Receiving against purchase order <strong>{v.poNumber}</strong>.</p>}
        {errors.purchase_order_id?.[0] && <p role="alert" className="mt-2 text-sm text-[#c23a3a]">{errors.purchase_order_id[0]}</p>}
        <div className="mt-4 border-t border-line pt-4"><StagedFiles files={staged} onChange={setStaged} /></div>
      </section>

      <section className="space-y-3">
        {v.lines.map((l, i) => {
          const acc = accepted(l);
          const err = errors[`lines.${i}.delivered`]?.[0] ?? errors[`lines.${i}.reason`]?.[0] ?? errors[`lines.${i}.unit_id`]?.[0] ?? errors[`lines.${i}.product_id`]?.[0] ?? errors[`lines.${i}.unit_cost`]?.[0] ?? errors[`lines.${i}.purchase_order_line_id`]?.[0] ?? errors[`lines.${i}.expiry_date`]?.[0];
          const units = ((l.product as Product | null)?.units ?? []).filter((u) => u.is_active);
          const flagged = int(l.damaged) + int(l.rejected) > 0;

          return (
            <div key={i} className="rounded-2xl border border-line bg-surface shadow-sm p-4">
              {l.poLineId ? (
                <p className="mb-3 font-medium">{l.product?.name} <span className="text-sm font-normal text-ink-soft">· {l.product?.sku} · counted in {l.unitName.toLowerCase()}s</span></p>
              ) : (
                <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
                  <ProductPicker value={(l.product as Product | null)} onChange={(p) => { const u = biggestUnit(p); patch(i, { product: p, unitId: u?.unit_id.toString() ?? "", unitName: u?.unit?.name ?? "", factor: u?.factor ?? 1 }); }} />
                  <label className="text-sm font-medium">
                    Counted in
                    <select value={l.unitId} disabled={!l.product} onChange={(e) => {
                      const u = units.find((x) => String(x.unit_id) === e.target.value);
                      patch(i, { unitId: e.target.value, unitName: u?.unit?.name ?? "", factor: u?.factor ?? 1 });
                    }} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-sm font-normal">
                      {units.map((u) => <option key={u.id} value={u.unit_id}>{u.unit?.name}{u.is_base ? "" : ` (×${u.factor})`}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {l.product && l.factor > 1 && (
                <p className="mb-2 text-xs text-ink-soft">
                  1 {l.unitName.toLowerCase()} = {l.factor} {(l.product as Product).base_unit?.name?.toLowerCase() ?? "units"}.
                  {int(l.delivered) > 0 && ` Delivered ${int(l.delivered)} ${l.unitName.toLowerCase()}${int(l.delivered) === 1 ? "" : "s"} = ${(int(l.delivered) * l.factor).toLocaleString("en-NG")} ${(l.product as Product).base_unit?.name?.toLowerCase() ?? "units"}.`}
                  {l.cost !== "" && ` About ₦${(Number(l.cost) / l.factor).toLocaleString("en-NG", { maximumFractionDigits: 2 })} each.`}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <label className="text-sm font-medium">Delivered<input inputMode="numeric" value={l.delivered} onChange={(e) => patch(i, { delivered: digits(e.target.value) })} className={`${num} mt-1 font-normal`} /></label>
                <label className="text-sm font-medium">Damaged<input inputMode="numeric" value={l.damaged} onChange={(e) => patch(i, { damaged: digits(e.target.value) })} className={`${num} mt-1 font-normal`} /></label>
                <label className="text-sm font-medium">Rejected<input inputMode="numeric" value={l.rejected} onChange={(e) => patch(i, { rejected: digits(e.target.value) })} className={`${num} mt-1 font-normal`} /></label>
                <div className="text-sm font-medium">Accepted<p className={`mt-1 flex min-h-11 items-center justify-end rounded-xl bg-paper px-2 font-semibold ${acc < 0 ? "text-[#c23a3a]" : "text-[#f40009]"}`}>{l.delivered === "" ? "–" : acc}</p></div>
                <label className="col-span-2 text-sm font-medium sm:col-span-1">Cost per {l.unitName ? l.unitName.toLowerCase() : "unit"} (₦)<input inputMode="decimal" value={l.cost} onChange={(e) => patch(i, { cost: e.target.value.replace(/[^\d.]/g, "") })} className={`${num} mt-1 font-normal`} /></label>
              </div>

              {tracked(l) && acc > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Expiry date" type="date" value={l.expiry} onChange={(e) => patch(i, { expiry: e.target.value })} required hint="Printed on the crate or bottle. Needed so the oldest stock sells first." />
                  <Field label="Batch number (optional)" value={l.batchNo} onChange={(e) => patch(i, { batchNo: e.target.value })} />
                </div>
              )}

              {flagged && (
                <div className="mt-3"><Field label="What went wrong?" value={l.reason} onChange={(e) => patch(i, { reason: e.target.value })} placeholder="e.g. Broken crates on the truck" /></div>
              )}
              {err && <p role="alert" className="mt-2 text-sm text-[#c23a3a]">{err}</p>}

              {!l.poLineId && v.lines.length > 1 && (
                <button type="button" onClick={() => setV((s) => ({ ...s, lines: s.lines.filter((_, idx) => idx !== i) }))} className="mt-3 text-sm text-[#c23a3a] hover:underline">Remove this line</button>
              )}
            </div>
          );
        })}

        {!locked && v.lines.length < 50 && (
          <Button type="button" variant="secondary" onClick={() => setV((s) => ({ ...s, lines: [...s.lines, blankLine()] }))}>Add another product</Button>
        )}
      </section>

      {formError && !Object.keys(errors).length && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{formError}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Value of accepted goods: <strong className="text-ink">{formatNaira(value)}</strong></p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!complete}>Save as draft</Button>
        </div>
      </div>
    </form>
  );
}
