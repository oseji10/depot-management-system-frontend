"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import type { Paginated, Product, Unit } from "../lib/types";
import { Button, Field, Modal } from "./ui";
import { useVariations } from "./variation-picker";

export type ProductKind = "regular" | "variations" | "bundle";

/** One way the product is sold, with the quantity in it as typed (optional when the product has only one). */
export type VariationRow = { name: string; qty: string; barcode: string };

/**
 * How the rows become what the server stores. Stock is kept as one count, in the variation with the smallest quantity,
 * so with two or more variations each needs a quantity, and each must be a whole multiple of the smallest one.
 */
export function planVariations(rows: VariationRow[]): { error: string | null; base?: VariationRow; baseQty: number | null; others: { name: string; factor: number; quantity: number; barcode: string | null }[] } {
  const list = rows.filter((r) => r.name.trim());
  if (list.length === 0) return { error: "Choose at least one variation.", baseQty: null, others: [] };
  if (list.length === 1) return { error: null, base: list[0], baseQty: Number(list[0].qty) || null, others: [] };

  const missing = list.find((r) => !(Number(r.qty) > 0));
  if (missing) return { error: `Enter the quantity in ${missing.name}. With more than one variation, the quantities say how they relate (e.g. Crate 24, Half crate 12).`, baseQty: null, others: [] };

  const sorted = [...list].sort((a, b) => Number(a.qty) - Number(b.qty));
  const base = sorted[0];
  const min = Number(base.qty);
  const same = sorted.find((r, i) => i > 0 && Number(r.qty) === min);
  if (same) return { error: `${same.name} and ${base.name} have the same quantity. Give each variation a different one.`, baseQty: null, others: [] };
  const odd = sorted.find((r) => Number(r.qty) % min !== 0);
  if (odd) return { error: `${odd.name} (${odd.qty}) must be a whole number of ${base.name} (${min}), so stock can be split between them.`, baseQty: null, others: [] };

  return {
    error: null, base, baseQty: min,
    others: sorted.slice(1).map((r) => ({ name: r.name.trim(), factor: Number(r.qty) / min, quantity: Number(r.qty), barcode: r.barcode || null })),
  };
}

const ICON = {
  regular: "M3 7h18M5 7v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 11h6M4 4h16v3H4z",
  variations: "M12 3 3 7.5 12 12l9-4.5L12 3ZM3 7.5V16.5L12 21l9-4.5V7.5M12 12v9",
  bundle: "M12 3 3 7.5 12 12l9-4.5L12 3ZM3 7.5V16.5L12 21M12 12v9M16 15h6M19 12v6",
};

/** The three product types, as cards (like Bumpa's "Select Product Type"). */
export function ProductTypeCards({ value, onChange, lockedTo }: { value: ProductKind; onChange: (k: ProductKind) => void; lockedTo?: ProductKind }) {
  const cards: { k: ProductKind; title: string; text: string; soon?: boolean }[] = [
    { k: "regular", title: "Regular product", text: "Sold one way only, e.g. per bottle or per can." },
    { k: "variations", title: "Product with variations", text: "Sold in different ways, e.g. bottle, half crate and crate." },
    { k: "bundle", title: "Product bundle", text: "Several products grouped together and sold as one." },
  ];

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">Select product type</h3>
      <p className="mb-3 text-sm text-ink-soft">Is this a regular product, or is it sold in different ways like bottle, half crate and crate?</p>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Product type">
        {cards.map((c) => {
          const on = value === c.k;
          // A product cannot become a bundle (or stop being one) once it exists.
          const disabled = c.soon || (lockedTo !== undefined && (lockedTo === "bundle" ? c.k !== "bundle" : c.k === "bundle"));
          return (
            <button key={c.k} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(c.k)}
              className={`relative flex items-start gap-3 rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${on ? "border-[#f40009] bg-[#fff5f5]" : "border-line bg-white hover:border-[#f40009]/40"}`}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg border ${on ? "border-[#f40009]/30 bg-white text-[#f40009]" : "border-line bg-paper text-ink-soft"}`}>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[c.k]} /></svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{c.title}{c.soon && <span className="ml-1.5 rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-soft uppercase">Soon</span>}</span>
                <span className="block text-xs leading-snug text-ink-soft">{c.text}</span>
              </span>
              {on && (
                <span className="absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-[#f40009] text-white" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Pick which of your variations this product is sold in (from the Variations list), or create new ones. */
export function VariationsBox({ rows, onChange, errors, baseError }: {
  rows: VariationRow[]; onChange: (rows: VariationRow[]) => void; errors: Record<string, string[]>; baseError?: string;
}) {
  const { data: all = [], isLoading } = useVariations();
  const [creating, setCreating] = useState(false);
  const isOn = (name: string) => rows.some((r) => r.name.toLowerCase() === name.toLowerCase());
  const update = (i: number, patch: Partial<VariationRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const valueOf = (name: string) => all.find((u) => u.name.toLowerCase() === name.toLowerCase())?.value;
  const plan = planVariations(rows);

  const addMany = (units: Unit[], current: VariationRow[]) => {
    const next = [...current];
    for (const u of units) {
      if (!next.some((r) => r.name.toLowerCase() === u.name.toLowerCase())) next.push({ name: u.name, qty: u.usual_size ? String(u.usual_size) : "", barcode: "" });
    }
    onChange(next);
  };
  const pick = (u: Unit) => (isOn(u.name) ? onChange(rows.filter((r) => r.name.toLowerCase() !== u.name.toLowerCase())) : addMany([u], rows));

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Product variations</h3>
        <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>+ Add variation</Button>
      </div>

      <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
        <p className="mb-2 text-sm text-ink-soft">Tick the variations this product is sold in.</p>
        {isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : all.length === 0 ? (
          <p className="text-sm text-ink-soft">You have no variations yet. Add some, e.g. Full crate, Half crate.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {all.map((u) => {
              const on = isOn(u.name);
              return (
                <label key={u.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${on ? "border-[#f40009] bg-[#fff1f1]" : "border-line bg-white hover:bg-paper"}`}>
                  <input type="checkbox" className="size-4 accent-[#f40009]" checked={on} onChange={() => pick(u)} />
                  <span className="font-medium">{u.name}</span>
                  {(u.value || u.usual_size) && <span className="text-xs text-ink-soft">{[u.value, u.usual_size ? `× ${u.usual_size}` : null].filter(Boolean).join(" · ")}</span>}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="text-[11px] tracking-wider text-ink-soft uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-semibold">Variation</th>
                  <th className="px-4 py-2.5 font-semibold">Quantity{rows.length === 1 ? " (optional)" : ""}</th>
                  <th className="px-4 py-2.5 font-semibold">Barcode</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p>{valueOf(r.name) && <p className="text-xs text-ink-soft">{valueOf(r.name)}</p>}</td>
                    <td className="px-4 py-2.5">
                      <input inputMode="numeric" value={r.qty} onChange={(e) => update(i, { qty: e.target.value.replace(/[^\d]/g, "") })} placeholder="e.g. 24"
                        aria-label={`Quantity in ${r.name}`} className="min-h-10 w-24 rounded-lg border border-line px-3 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={r.barcode} onChange={(e) => update(i, { barcode: e.target.value })} aria-label={`${r.name} barcode`} className="min-h-10 w-36 rounded-lg border border-line px-3 text-sm" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-[#c23a3a] hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.error && rows.length > 1 && <p className="border-t border-line px-4 py-2 text-xs text-[#c23a3a]">{plan.error}</p>}
        </div>
      )}
      {(baseError || errors.units?.[0]) && <p role="alert" className="mt-2 text-xs text-[#c23a3a]">{baseError ?? errors.units?.[0]}</p>}

      {creating && typeof document !== "undefined" && createPortal(
        <AddVariationsModal onClose={() => setCreating(false)} onCreated={(units) => { setCreating(false); addMany(units, rows); }} />,
        document.body,
      )}
    </section>
  );
}

type Draft = { name: string; value: string; qty: string };
const blank = (): Draft => ({ name: "", value: "", qty: "" });

/** Add one or several variations at once: a name, a value (any text) and an optional quantity for each. */
export function AddVariationsModal({ onClose, onCreated }: { onClose: () => void; onCreated: (units: Unit[]) => void }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<Draft[]>([blank()]);
  const set = (i: number, patch: Partial<Draft>) => setItems((cur) => cur.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const ready = items.filter((d) => d.name.trim());

  const save = useMutation({
    mutationFn: () => api<{ data: Unit[] }>("/units/bulk", { method: "POST", body: { items: ready.map((d) => ({ name: d.name.trim(), value: d.value.trim() || null, usual_size: d.qty ? Number(d.qty) : null })) } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["variations-all"] });
      void qc.invalidateQueries({ queryKey: ["list", "/units"] });
      onCreated(r?.data ?? ready.map((d, i) => ({ id: -i - 1, name: d.name.trim(), abbreviation: "", value: d.value || null, usual_size: d.qty ? Number(d.qty) : null })));
    },
  });

  return (
    <Modal title="Add variation" onClose={onClose}>
      <div className="space-y-3">
        {items.map((d, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Variation {items.length > 1 ? i + 1 : ""}</p>
              {items.length > 1 && <button type="button" onClick={() => setItems((cur) => cur.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-[#c23a3a] hover:underline">Remove</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" value={d.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Full crate" required autoFocus={i === items.length - 1} />
              <Field label="Value" value={d.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="e.g. 24 bottles" />
              <Field label="Quantity (optional)" inputMode="numeric" value={d.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/[^\d]/g, "") })} placeholder="e.g. 24" />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItems((cur) => [...cur, blank()])} className="text-sm font-semibold text-[#f40009] hover:underline">+ Add another variation</button>
        {save.error && <p role="alert" className="text-sm text-[#c23a3a]">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" busy={save.isPending} disabled={ready.length === 0} onClick={() => save.mutate()}>Save {ready.length > 1 ? `${ready.length} variations` : "variation"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** One product inside a bundle, in one of its variations. */
export type BundleRow = { product_id: number; name: string; unit_id: number; quantity: string; units: { unit_id: number; name: string; factor: number }[] };

export const toBundleRow = (p: Product, unitId?: number, qty = 1): BundleRow => ({
  product_id: p.id, name: p.name, unit_id: unitId ?? p.base_unit_id, quantity: String(qty),
  units: [...p.units].filter((u) => u.is_active).sort((a, b) => a.factor - b.factor).map((u) => ({ unit_id: u.unit_id, name: u.unit?.name ?? "", factor: u.factor })),
});

/** "Select products": the items that make up a bundle (up to 20). */
export function BundleBox({ rows, onChange, errors, bundleId }: { rows: BundleRow[]; onChange: (rows: BundleRow[]) => void; errors: Record<string, string[]>; bundleId?: number }) {
  const [open, setOpen] = useState(false);
  const update = (i: number, patch: Partial<BundleRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <section>
      <h3 className="mb-2 text-base font-semibold">Select products</h3>
      {rows.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-8 text-center">
          <span className="grid size-14 place-items-center rounded-xl bg-white text-[#f40009] shadow-sm">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON.bundle} /></svg>
          </span>
          <p className="max-w-sm text-sm text-ink-soft">Add up to 20 individual products that make up this bundle.</p>
          <Button type="button" onClick={() => setOpen(true)}>Select products</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2.5">
            <p className="text-sm"><span className="font-semibold">{rows.length}</span> product{rows.length === 1 ? "" : "s"} in this bundle</p>
            {rows.length < 20 && <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-[#f40009] hover:underline">Add products</button>}
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r, i) => (
              <li key={`${r.product_id}-${i}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-center">
                <p className="font-medium">{r.name}</p>
                <div>
                  <input inputMode="numeric" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value.replace(/[^\d]/g, "") })} aria-label={`How many ${r.name}`}
                    className="min-h-10 w-full rounded-lg border border-line px-3 text-sm" />
                  {errors[`bundle_items.${i}.quantity`]?.[0] && <p className="mt-1 text-xs text-[#c23a3a]">{errors[`bundle_items.${i}.quantity`][0]}</p>}
                </div>
                <select value={r.unit_id} onChange={(e) => update(i, { unit_id: Number(e.target.value) })} aria-label={`${r.name} variation`}
                  className="min-h-10 rounded-lg border border-line bg-white px-2 text-sm">
                  {r.units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.name}{u.factor > 1 ? ` (${u.factor})` : ""}</option>)}
                </select>
                <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-[#c23a3a] hover:underline">Remove</button>
                {(errors[`bundle_items.${i}.product_id`]?.[0] || errors[`bundle_items.${i}.unit_id`]?.[0]) && <p className="text-xs text-[#c23a3a] sm:col-span-4">{errors[`bundle_items.${i}.product_id`]?.[0] ?? errors[`bundle_items.${i}.unit_id`]?.[0]}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {errors.bundle_items?.[0] && <p role="alert" className="mt-2 text-xs text-[#c23a3a]">{errors.bundle_items[0]}</p>}
      <p className="mt-2 text-xs text-ink-soft">The products that are sold together as this bundle. Set the bundle&apos;s price in your price list like any other product.</p>
      {open && <SelectProductsSheet picked={rows} bundleId={bundleId} onClose={() => setOpen(false)} onDone={(next) => { onChange(next); setOpen(false); }} />}
    </section>
  );
}

function SelectProductsSheet({ picked, bundleId, onClose, onDone }: { picked: BundleRow[]; bundleId?: number; onClose: () => void; onDone: (rows: BundleRow[]) => void }) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Map<number, Product>>(new Map());
  const list = useQuery({
    queryKey: ["bundle-pick", search],
    queryFn: () => api<Paginated<Product>>(`/products?per_page=50&status=active${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`),
  });
  const already = new Set(picked.map((r) => r.product_id));
  const options = (list.data?.data ?? []).filter((p) => !p.is_bundle && p.id !== bundleId);
  const room = 20 - picked.length;

  const toggle = (p: Product) => setChosen((cur) => {
    const next = new Map(cur);
    if (next.has(p.id)) next.delete(p.id); else if (next.size < room) next.set(p.id, p);
    return next;
  });

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/40" onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div className="mt-[6vh] flex min-h-0 flex-1 flex-col rounded-t-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Select products">
        <div className="flex justify-end p-4"><button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-xl border border-line text-lg hover:bg-paper">×</button></div>
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pb-4">
          <h2 className="mb-1 text-2xl font-bold">Select products</h2>
          <p className="mb-3 text-sm text-ink-soft">Tick the products that go in this bundle. You can set how many of each next. {room < 20 && `${room} more can be added.`}</p>
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU" aria-label="Search products"
            className="mb-3 min-h-11 w-full rounded-xl border border-line px-3 text-sm focus:border-[#f40009] focus:outline-none" />
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
            {list.isLoading && <li className="px-4 py-3 text-sm text-ink-soft">Loading…</li>}
            {!list.isLoading && options.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No products found.</li>}
            {options.map((p) => {
              const inBundle = already.has(p.id);
              const on = chosen.has(p.id);
              return (
                <li key={p.id}>
                  <label className={`flex items-center gap-3 px-4 py-3 text-sm ${inBundle ? "opacity-50" : "cursor-pointer hover:bg-paper"}`}>
                    <input type="checkbox" className="size-4 accent-[#f40009]" disabled={inBundle || (!on && chosen.size >= room)} checked={on || inBundle} onChange={() => toggle(p)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.name}</span>
                      <span className="text-xs text-ink-soft">{p.sku}{inBundle ? " · already in the bundle" : ""}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-ink px-4 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={chosen.size === 0} onClick={() => onDone([...picked, ...[...chosen.values()].map((p) => toBundleRow(p))])}>Add {chosen.size || ""} product{chosen.size === 1 ? "" : "s"}</Button>
        </div>
      </div>
    </div>
  );
}
