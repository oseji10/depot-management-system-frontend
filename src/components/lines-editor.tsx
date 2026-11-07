"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Product } from "../lib/types";
import { STATUS_LABEL } from "../lib/units";
import { Button } from "./ui";
import { ProductPicker } from "./product-picker";

export type StockLine = { product: Product | null; unitId: string; qty: string; status: string; toStatus: string; cost: string };

export const emptyLine = (): StockLine => ({ product: null, unitId: "", qty: "", status: "saleable", toStatus: "damaged", cost: "" });

/** Quantity in base units, from "3 crates" or "7 bottles". */
export function toBaseQty(line: StockLine): number {
  const n = Number(line.qty);
  if (!line.product || !Number.isFinite(n)) return 0;
  const unit = line.product.units.find((u) => String(u.unit_id) === line.unitId) ?? line.product.units.find((u) => u.is_base);
  return Math.round(n * (unit?.factor ?? 1));
}

/** Base units in the unit currently chosen on the line (1 for a bottle, 12 for a crate of 12). */
export function lineFactor(line: StockLine): number {
  const unit = line.product?.units.find((u) => String(u.unit_id) === line.unitId) ?? line.product?.units.find((u) => u.is_base);
  return unit?.factor ?? 1;
}

/** The pack a depot usually buys and counts in: the biggest active unit (a crate), falling back to the base unit. */
export function biggestUnit(p: Product | null | undefined) {
  const units = (p?.units ?? []).filter((u) => u.is_active);
  return units.reduce<(typeof units)[number] | undefined>((best, u) => (!best || u.factor > best.factor ? u : best), undefined) ?? p?.units.find((u) => u.is_base);
}

const selectClass = "min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-sm";

export function LinesEditor({ lines, setLines, showStatus = false, showToStatus = false, showCost = false, costPlaceholder, errors = {} }: {
  lines: StockLine[];
  setLines: Dispatch<SetStateAction<StockLine[]>>;
  showStatus?: boolean;
  showToStatus?: boolean;
  showCost?: boolean;
  costPlaceholder?: string;
  errors?: Record<string, string[]>;
}) {
  const patch = (i: number, p: Partial<StockLine>) => setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const units = (line.product?.units ?? []).filter((u) => u.is_active);
        const err = errors[`lines.${i}.product_id`]?.[0] ?? errors[`lines.${i}.unit_id`]?.[0] ?? errors[`lines.${i}.unit_cost`]?.[0] ?? errors[`lines.${i}.quantity`]?.[0] ?? errors[`lines.${i}.to_status`]?.[0];

        return (
          <div key={i} className="rounded-xl bg-paper p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ProductPicker value={line.product} onChange={(p) => patch(i, { product: p, unitId: ((showCost ? biggestUnit(p) : undefined) ?? p?.units.find((u) => u.is_base))?.unit_id.toString() ?? "" })} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
                <label className="text-sm font-medium">
                  Unit
                  <select value={line.unitId} onChange={(e) => patch(i, { unitId: e.target.value })} disabled={!line.product} className={`${selectClass} mt-1 font-normal`}>
                    {units.map((u) => (
                      <option key={u.id} value={u.unit_id}>{u.unit?.name}{u.is_base ? "" : ` (×${u.factor})`}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Quantity
                  <input inputMode="numeric" value={line.qty} onChange={(e) => patch(i, { qty: e.target.value.replace(/[^\d]/g, "") })}
                    className={`${selectClass} mt-1 text-right font-normal`} />
                </label>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((cur) => cur.filter((_, idx) => idx !== i))} className="col-span-2 min-h-11 text-sm text-[#c23a3a] hover:underline sm:col-span-1">Remove</button>
                )}
              </div>

              {showCost && (
                <label className="text-sm font-medium sm:col-span-2">
                  Cost per {line.product?.units.find((u) => String(u.unit_id) === line.unitId)?.unit?.name?.toLowerCase() ?? "unit"} (₦)
                  <input inputMode="decimal" placeholder={costPlaceholder} value={line.cost} onChange={(e) => patch(i, { cost: e.target.value.replace(/[^\d.]/g, "") })}
                    className={`${selectClass} mt-1 text-right font-normal`} />
                </label>
              )}

              {(showStatus || showToStatus) && (
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  {showStatus && (
                    <label className="text-sm font-medium">
                      {showToStatus ? "From" : "Stock status"}
                      <select value={line.status} onChange={(e) => patch(i, { status: e.target.value })} className={`${selectClass} mt-1 font-normal`}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                  )}
                  {showToStatus && (
                    <label className="text-sm font-medium">
                      Move to
                      <select value={line.toStatus} onChange={(e) => patch(i, { toStatus: e.target.value })} className={`${selectClass} mt-1 font-normal`}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </div>

            {line.product && Number(line.qty) > 0 && (
              <p className="mt-1 text-xs text-ink-soft">
                = {toBaseQty(line)} {line.product.base_unit?.name ?? "units"} in total
                {showCost && line.cost !== "" && lineFactor(line) > 1 ? ` · ₦${(Number(line.cost) / lineFactor(line)).toLocaleString("en-NG", { maximumFractionDigits: 2 })} each` : ""}
              </p>
            )}
            {err && <p role="alert" className="mt-1 text-xs text-[#c23a3a]">{err}</p>}
          </div>
        );
      })}

      {lines.length < 50 && (
        <Button type="button" variant="secondary" onClick={() => setLines((cur) => [...cur, emptyLine()])}>Add another product</Button>
      )}
    </div>
  );
}
