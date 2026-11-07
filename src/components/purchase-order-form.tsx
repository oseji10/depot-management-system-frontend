"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOptions } from "../hooks/options";
import { ApiError, api } from "../lib/api";
import type { Product, PurchaseOrder } from "../lib/types";
import { emptyLine, LinesEditor, type StockLine } from "./lines-editor";
import { Button, Field, Modal, SelectField } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);

export function PurchaseOrderForm({ po, onClose, onSaved }: { po?: PurchaseOrder; onClose: () => void; onSaved?: () => void }) {
  const queryClient = useQueryClient();
  const suppliers = useOptions("/suppliers");
  const warehouses = useOptions("/warehouses");

  const [supplierId, setSupplierId] = useState(po ? String(po.supplier_id) : "");
  const [warehouseId, setWarehouseId] = useState(po ? String(po.warehouse_id) : "");
  const [orderDate, setOrderDate] = useState(po?.order_date ?? today());
  const [expected, setExpected] = useState(po?.expected_date ?? "");
  const [note, setNote] = useState(po?.note ?? "");
  const [lines, setLines] = useState<StockLine[]>(
    po?.lines?.length
      ? po.lines.map((l) => ({ ...emptyLine(), product: l.product as unknown as Product, unitId: String(l.unit_id), qty: String(l.quantity), cost: String(Number(l.unit_cost)) }))
      : [emptyLine()],
  );
  // Costs come from the price list unless the user chooses to type their own (a blank one still uses the price list).
  const [ownCost, setOwnCost] = useState(!!po);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const complete = !!supplierId && !!warehouseId && lines.every((l) => l.product && Number(l.qty) > 0);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        supplier_id: Number(supplierId), warehouse_id: Number(warehouseId), order_date: orderDate, expected_date: expected || null, note: note || null,
        lines: lines.map((l) => ({ product_id: l.product!.id, unit_id: Number(l.unitId), quantity: Number(l.qty), unit_cost: ownCost && l.cost !== "" ? Number(l.cost) : null })),
      };
      return po ? api(`/purchase-orders/${po.id}`, { method: "PUT", body }) : api("/purchase-orders", { method: "POST", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list", "/purchase-orders"] });
      if (po) queryClient.invalidateQueries({ queryKey: ["purchase-order", String(po.id)] });
      onSaved?.();
      onClose();
    },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  return (
    <Modal title={po ? `Edit ${po.number}` : "New purchase order"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Supplier" value={supplierId} onChange={setSupplierId} required options={[{ value: "", label: "Select a supplier" }, ...suppliers]} error={errors.supplier_id?.[0]} />
          <SelectField label="Deliver to" value={warehouseId} onChange={setWarehouseId} required options={[{ value: "", label: "Select a warehouse" }, ...warehouses]} error={errors.warehouse_id?.[0]} />
          <Field label="Order date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} error={errors.order_date?.[0]} required />
          <Field label="Expected on" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} error={errors.expected_date?.[0]} />
        </div>

        <label className="flex items-start gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
          <input type="checkbox" checked={ownCost} onChange={(e) => setOwnCost(e.target.checked)} className="mt-0.5 size-4 accent-[#f40009]" />
          <span>
            <span className="font-medium">I want to enter my own costs</span>
            <span className="block text-xs text-ink-soft">Off: each line uses today&apos;s price from the price list. On: type a cost per line; leave one blank to use the price list for it.</span>
          </span>
        </label>

        <LinesEditor lines={lines} setLines={setLines} showCost={ownCost} costPlaceholder="Price list" errors={errors} />

        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        {formError && !Object.keys(errors).length && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!complete}>{po ? "Save changes" : "Save as draft"}</Button>
        </div>
      </form>
    </Modal>
  );
}
