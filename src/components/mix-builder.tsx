"use client";

import { useMemo, useState } from "react";
import { formatKobo } from "../lib/format";
import type { MixLayoutChoice, PosProduct, PosUnit } from "../lib/types";
import { Button, Modal } from "./ui";

export type MixPick = { product: PosProduct; unit: PosUnit; qty: number };

const baseUnit = (p: PosProduct) => p.units.find((u) => u.factor === 1);

/**
 * One crate shared between products: pick a layout (set by an administrator, e.g. 4 rows of 6) and give each row a
 * product. Every product in a mixed crate must cost the same per bottle, so choosing the first product narrows the
 * others to the same price. `used` is how many bottles of each product are already in the sale.
 */
export function MixBuilder({ layouts, products, used, onAdd, onClose }: {
  layouts: MixLayoutChoice[];
  products: PosProduct[];
  used: Map<number, number>;
  onAdd: (layout: MixLayoutChoice, picks: MixPick[]) => void;
  onClose: () => void;
}) {
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? 0);
  const layout = layouts.find((l) => l.id === layoutId) ?? layouts[0];
  const [rows, setRows] = useState<(number | null)[]>(() => Array<number | null>(layouts[0]?.row_count ?? 0).fill(null));

  const sellable = useMemo(() => products.filter((p) => baseUnit(p)), [products]);
  const chosen = rows.filter((r): r is number => r !== null);
  const lockedPrice = chosen.length ? baseUnit(sellable.find((p) => p.id === chosen[0])!)!.price : null;

  function pickLayout(id: number) {
    setLayoutId(id);
    setRows(Array<number | null>(layouts.find((l) => l.id === id)?.row_count ?? 0).fill(null));
  }

  if (!layout) return null;

  const size = layout.row_size;
  const bottlesOf = (id: number, ignoreRow = -1) => rows.reduce<number>((n, r, i) => n + (r === id && i !== ignoreRow ? size : 0), 0);
  const optionsFor = (row: number) =>
    sellable.filter((p) => {
      const price = baseUnit(p)!.price;
      const free = p.stock - (used.get(p.id) ?? 0) - bottlesOf(p.id, row);
      return rows[row] === p.id || (free >= size && (lockedPrice === null || price === lockedPrice));
    });

  const complete = rows.length > 0 && rows.every((r) => r !== null);

  function confirm() {
    const counts = new Map<number, number>();
    rows.forEach((r) => r !== null && counts.set(r, (counts.get(r) ?? 0) + size));
    onAdd(layout, [...counts].map(([id, qty]) => {
      const product = sellable.find((p) => p.id === id)!;
      return { product, unit: baseUnit(product)!, qty };
    }));
  }

  return (
    <Modal title="Mixed crate" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Share one crate between products. Only products with the same price can be mixed.</p>

        <div role="group" aria-label="Layout" className="flex flex-wrap gap-2">
          {layouts.map((l) => (
            <button key={l.id} type="button" aria-pressed={l.id === layoutId} onClick={() => pickLayout(l.id)}
              className={`min-h-10 rounded-xl border px-4 text-sm font-semibold ${l.id === layoutId ? "border-[#f40009] bg-[#f40009] text-white" : "border-line bg-white"}`}>
              {l.name}<span className="ml-1 text-xs font-normal opacity-80">({l.row_count} × {l.row_size})</span>
            </button>
          ))}
        </div>

        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-ink-soft">Row {i + 1} · {size}</span>
              <select aria-label={`Product for row ${i + 1}`} value={r ?? ""} onChange={(e) => setRows((x) => x.map((v, j) => (j === i ? (e.target.value ? Number(e.target.value) : null) : v)))}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm">
                <option value="">Choose a product</option>
                {optionsFor(i).map((p) => <option key={p.id} value={p.id}>{p.name}{p.size_label ? ` ${p.size_label}` : ""}</option>)}
              </select>
            </li>
          ))}
        </ol>

        {lockedPrice !== null && <p className="text-sm text-ink-soft">{formatKobo(lockedPrice)} per bottle · crate total <strong className="text-ink">{formatKobo(lockedPrice * layout.row_count * size)}</strong></p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!complete} onClick={confirm}>Add to sale</Button>
        </div>
      </div>
    </Modal>
  );
}
