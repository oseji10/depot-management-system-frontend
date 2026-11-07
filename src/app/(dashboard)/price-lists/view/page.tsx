"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, PageHeader, TableLoading } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatNaira } from "../../../../lib/format";
import type { PriceList, PriceRow } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function PriceListEditorPage() {
  const id = useIdParam();
  const s = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  const [pct, setPct] = useState("");
  // Per row: true = typed by hand, false = worked out from the biggest priced pack. Unset = decided from what is saved.
  const [manual, setManual] = useState<Record<number, boolean>>({});

  const list = useQuery({ queryKey: ["price-list", id], queryFn: () => api<PriceList>(`/price-lists/${id}`) });
  const rows = useQuery({ queryKey: ["price-rows", id], queryFn: () => api<{ data: PriceRow[] }>(`/price-lists/${id}/prices`) });

  const canEdit = s.can("pricing.manage");
  const isPromo = list.data?.type === "promo";

  const makeDefault = useMutation({
    mutationFn: () => {
      const l = list.data!;
      return api(`/price-lists/${id}`, { method: "PUT", body: { name: l.name, type: "standard", is_default: true, is_active: true, priority: l.priority } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list"] });
      queryClient.invalidateQueries({ queryKey: ["price-rows"] });
      queryClient.invalidateQueries({ queryKey: ["list", "/price-lists"] });
    },
  });
  const notDefault = !!list.data && list.data.type === "standard" && !list.data.is_default;

  /**
   * Smaller units can be priced from the biggest priced pack of the same product:
   * a 12-bottle pack at 4,550 gives 379.17 a bottle. The user can switch any row to a hand-typed price.
   */
  const calc = useMemo(() => {
    const all = rows.data?.data ?? [];
    const priceOf = (r: PriceRow) => {
      const e = edits[r.product_unit_id];
      const v = e !== undefined ? e : r.price !== null ? String(Number(r.price)) : "";
      return v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
    };

    // Source = the biggest pack that has a typed/saved (non-derived) price.
    const byProduct = new Map<string, PriceRow[]>();
    for (const r of all) byProduct.set(r.sku, [...(byProduct.get(r.sku) ?? []), r]);

    const out = new Map<number, { value: string | null; source: PriceRow; auto: boolean }>();
    for (const group of byProduct.values()) {
      const sorted = [...group].sort((a, b) => b.factor - a.factor);
      const source = sorted.find((r) => r.factor > 1 && priceOf(r) !== null);
      if (!source) continue;
      const per = priceOf(source)! / source.factor;

      for (const r of group) {
        if (r.factor >= source.factor) continue;
        const derived = Math.round(per * r.factor * 100) / 100;
        const saved = r.price !== null ? Number(r.price) : null;
        const isManual = manual[r.product_unit_id] ?? (saved !== null && Math.abs(saved - derived) > 0.005);
        // On a promotion, nothing is added on its own; the user presses "Use ÷N".
        const auto = !isManual && (!isPromo || saved !== null || manual[r.product_unit_id] === false);
        out.set(r.product_unit_id, { value: String(derived), source, auto });
      }
    }
    return out;
  }, [rows.data, edits, manual, isPromo]);

  /** Everything that will be sent: typed edits, plus derived prices that differ from what is saved. */
  const pending = useMemo(() => {
    const m = new Map<number, string>();
    for (const [k, v] of Object.entries(edits)) m.set(Number(k), v);
    for (const r of rows.data?.data ?? []) {
      const c = calc.get(r.product_unit_id);
      if (!c?.auto || c.value === null) continue;
      const saved = r.price !== null ? Number(r.price) : null;
      if (saved === null || Math.abs(saved - Number(c.value)) > 0.005) m.set(r.product_unit_id, c.value);
      else m.delete(r.product_unit_id);
    }
    return m;
  }, [edits, calc, rows.data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/price-lists/${id}/prices`, {
        method: "PUT",
        body: {
          prices: [...pending.entries()].map(([unitId, value]) => ({
            product_unit_id: unitId,
            price: value.trim() === "" ? null : Number(value),
          })),
        },
      }),
    onSuccess: () => {
      setEdits({});
      setManual({});
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["price-rows", id] });
      queryClient.invalidateQueries({ queryKey: ["price-list", id] });
      queryClient.invalidateQueries({ queryKey: ["list", "/price-lists"] });
    },
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows.data?.data ?? []).filter((r) => !q || r.product_name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }, [rows.data, search]);

  /** Promotions: price every product shown at a percentage below its standard price. */
  const applyDiscount = () => {
    const off = Number(pct);
    if (!(off > 0 && off < 100)) return;
    const next: Record<number, string> = {};
    const hand: Record<number, boolean> = {};
    for (const r of visible) {
      if (!r.standard_price || Number(r.standard_price) <= 0) continue;
      next[r.product_unit_id] = String(Math.round(Number(r.standard_price) * (1 - off / 100) * 100) / 100);
      hand[r.product_unit_id] = true;
    }
    setSaved(false);
    setEdits((cur) => ({ ...cur, ...next }));
    setManual((cur) => ({ ...cur, ...hand }));
  };

  const invalid = [...pending.values()].some((v) => v.trim() !== "" && (Number.isNaN(Number(v)) || Number(v) < 0));
  const changed = pending.size;

  return (
    <>
      <Link href="/price-lists" className="mb-2 inline-block text-sm text-ink-soft hover:underline">
        ← Price lists
      </Link>

      {notDefault && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p><strong>The till does not use this list.</strong> It sells at the prices in your <em>default</em> standard list, and this one is not it, so products priced only here show as having no price.</p>
          {canEdit && (
            <Button className="mt-3" busy={makeDefault.isPending} onClick={() => makeDefault.mutate()}>Make “{list.data?.name}” the default list</Button>
          )}
          {makeDefault.error && <p className="mt-2 text-[#c23a3a]">{(makeDefault.error as Error).message}</p>}
        </div>
      )}

      <PageHeader
        title={list.data?.name ?? "Price list"}
        description={
          isPromo && list.data?.starts_on
            ? `Promotion running ${formatDate(list.data.starts_on)} – ${list.data.ends_on ? formatDate(list.data.ends_on) : "no end date"}. Only products you price here change during the promotion. Search for products first to discount just those, or use “Take % off” for everything shown.`
            : "Prices per unit, in naira. Smaller units are worked out from the biggest pack (pack price ÷ bottles in it); choose Custom to set your own. Leave a price empty to take it out of this list."
        }
        action={
          canEdit && (
            <Button onClick={() => { setSaved(false); save.mutate(); }} busy={save.isPending} disabled={!changed || invalid}>
              {changed ? `Save ${changed} change${changed > 1 ? "s" : ""}` : "Save"}
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="max-w-sm flex-1">
          <label htmlFor="price-search" className="sr-only">Search products</label>
          <input
            id="price-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
          />
        </div>
        {canEdit && isPromo && (
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="promo-pct" className="mb-1 block text-xs font-medium text-ink-soft">Take this % off the products shown</label>
              <input id="promo-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 10"
                className="min-h-11 w-28 rounded-xl border border-line bg-surface px-3 text-sm" />
            </div>
            <Button variant="secondary" onClick={applyDiscount} disabled={!(Number(pct) > 0 && Number(pct) < 100)}>Apply</Button>
          </div>
        )}
        {saved && !changed && <Badge tone="good">Prices saved</Badge>}
        {save.error && <span role="alert" className="text-sm text-[#c23a3a]">{(save.error as Error).message}</span>}
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Unit</th>
              {isPromo && <th scope="col" className="px-4 py-2.5 text-right font-medium">Standard price</th>}
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Price (₦)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.isLoading && <TableLoading cols={4} />}
            {!rows.isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-soft">
                  {rows.data?.data.length ? "No products match your search." : "Add products first, then price them here."}
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const c = calc.get(r.product_unit_id);
              const edited = c?.auto ? undefined : edits[r.product_unit_id];
              const derivedNow = c?.auto && c.value !== null ? c.value : null;
              const value = derivedNow ?? edited ?? (r.price !== null ? String(Number(r.price)) : "");
              const discount =
                isPromo && r.standard_price && value !== "" && Number(r.standard_price) > 0
                  ? Math.round((1 - Number(value) / Number(r.standard_price)) * 100)
                  : null;

              return (
                <tr key={r.product_unit_id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.product_name}</p>
                    <p className="text-xs text-ink-soft">{r.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.unit_name}{!r.is_base && <span className="text-ink-soft"> ×{r.factor}</span>}
                    {c && <p className="text-xs text-ink-soft">{c.auto ? `Pack price ÷ ${c.source.factor}` : "Custom price"}</p>}
                  </td>
                  {isPromo && (
                    <td className="px-4 py-2.5 text-right text-ink-soft">
                      {r.standard_price ? formatNaira(Number(r.standard_price)) : "–"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      {discount !== null && discount !== 0 && (
                        <Badge tone={discount > 0 ? "good" : "warn"}>{discount > 0 ? `−${discount}%` : `+${-discount}%`}</Badge>
                      )}
                      <input
                        inputMode="decimal"
                        aria-label={`Price for ${r.product_name}, ${r.unit_name}`}
                        disabled={!canEdit || !!c?.auto}
                        value={value}
                        onChange={(e) => { setSaved(false); setEdits((cur) => ({ ...cur, [r.product_unit_id]: e.target.value })); }}
                        className={`min-h-9 w-32 rounded-xl border px-2 text-right text-sm disabled:bg-paper ${
                          edited !== undefined || pending.has(r.product_unit_id) ? "border-amber-400 bg-amber-50" : "border-line"
                        }`}
                      />
                      {canEdit && c && (
                        c.auto ? (
                          <button type="button" className="text-xs font-semibold text-[#f40009] hover:underline"
                            onClick={() => { setSaved(false); setEdits((cur) => ({ ...cur, [r.product_unit_id]: c.value ?? "" })); setManual((m) => ({ ...m, [r.product_unit_id]: true })); }}>
                            Custom
                          </button>
                        ) : (
                          <button type="button" className="text-xs font-semibold text-[#f40009] hover:underline"
                            onClick={() => { setSaved(false); setEdits((cur) => { const n = { ...cur }; delete n[r.product_unit_id]; return n; }); setManual((m) => ({ ...m, [r.product_unit_id]: false })); }}>
                            Use ÷{c.source.factor}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default withSuspense(PriceListEditorPage);
