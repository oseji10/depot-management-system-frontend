"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPicker } from "../../../../components/product-picker";
import { Badge, Button, PageHeader } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import type { CountLine, Product, StockCountDoc } from "../../../../lib/types";
import { formatQty, largestPack, STATUS_LABEL } from "../../../../lib/units";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

type Entry = { packs: string; loose: string };
const keyOf = (l: { product_id: number; status: string }) => `${l.product_id}:${l.status}`;
const digits = (v: string) => v.replace(/[^\d]/g, "");

const TONE = { counting: "warn", submitted: "neutral", approved: "good", cancelled: "bad" } as const;
const LABEL = { counting: "Counting", submitted: "Waiting for approval", approved: "Approved", cancelled: "Cancelled" } as const;

function CountSheetPage() {
  const id = useIdParam();
  const s = useSession();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [seeded, setSeeded] = useState(false);
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const [addStatus, setAddStatus] = useState("saleable");

  const doc = useQuery({ queryKey: ["count", id], queryFn: () => api<StockCountDoc>(`/stock-counts/${id}`) });
  const count = doc.data;

  // Fill the inputs from saved counts once, so a half-finished count resumes where it stopped.
  useEffect(() => {
    if (!count?.lines || seeded) return;
    const next: Record<string, Entry> = {};
    for (const l of count.lines) {
      if (l.counted_quantity === null) continue;
      const pack = largestPack(l.product.units);
      next[keyOf(l)] = pack
        ? { packs: String(Math.trunc(l.counted_quantity / pack.factor)), loose: String(l.counted_quantity % pack.factor) }
        : { packs: "", loose: String(l.counted_quantity) };
    }
    setEntries(next);
    setSeeded(true);
  }, [count, seeded]);

  const counted = (l: CountLine): number | null => {
    const e = entries[keyOf(l)];
    if (!e || (e.packs === "" && e.loose === "")) return null;
    const pack = largestPack(l.product.units);
    return Number(e.packs || 0) * (pack?.factor ?? 1) + Number(e.loose || 0);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["count", id] });
    queryClient.invalidateQueries({ queryKey: ["list"] });
  };

  const save = useMutation({
    mutationFn: () =>
      api(`/stock-counts/${id}/lines`, {
        method: "PUT",
        body: { lines: (count?.lines ?? []).map((l) => ({ product_id: l.product_id, status: l.status, counted_quantity: counted(l) })) },
      }),
    onSuccess: refresh,
  });

  const submit = useMutation({
    mutationFn: async () => { await save.mutateAsync(); return api(`/stock-counts/${id}/submit`, { method: "POST" }); },
    onSuccess: refresh,
  });

  const act = useMutation({
    mutationFn: (action: "approve" | "cancel") => api(`/stock-counts/${id}/${action}`, { method: "POST" }),
    onSuccess: refresh,
  });

  const addLine = useMutation({
    mutationFn: () => api(`/stock-counts/${id}/lines`, { method: "PUT", body: { lines: [{ product_id: addProduct!.id, status: addStatus, counted_quantity: null }] } }),
    onSuccess: () => { setAddProduct(null); setSeeded(false); refresh(); },
  });

  if (!count) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const editable = count.status === "counting" && s.can("inventory.count");
  const lines = count.lines ?? [];
  const done = lines.filter((l) => counted(l) !== null).length;
  const drifted = lines.filter((l) => l.drifted).length;
  const error = (save.error ?? submit.error ?? act.error ?? addLine.error) as Error | null;
  const input = "min-h-9 w-20 rounded-xl border border-line bg-surface px-2 text-right text-sm disabled:bg-paper";

  return (
    <>
      <Link href="/stock-counts" className="mb-2 inline-block text-sm text-ink-soft hover:underline">← Stock counts</Link>

      <PageHeader
        title={`${count.number} · ${count.warehouse?.name}`}
        description={`Started by ${count.creator?.name}. ${count.status === "counting" ? `${done} of ${lines.length} lines counted. Enter 0 for anything you cannot find.` : ""}`}
        action={<Badge tone={TONE[count.status]}>{LABEL[count.status]}</Badge>}
      />

      {drifted > 0 && count.status !== "approved" && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">
          Stock moved in this warehouse after the count started ({drifted} line{drifted > 1 ? "s" : ""} marked). Approving sets the ledger to exactly what was counted, so double-check those lines.
        </p>
      )}

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">System says</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">You counted</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-soft">This warehouse has no recorded stock. Add the products you find below.</td></tr>}
            {lines.map((l) => {
              const pack = largestPack(l.product.units);
              const base = l.product.units.find((u) => u.is_base)?.unit?.name ?? "unit";
              const n = counted(l);
              const diff = count.status === "approved" ? l.posted_variance : n === null ? null : n - l.expected_quantity;
              const e = entries[keyOf(l)] ?? { packs: "", loose: "" };
              const set = (patch: Partial<Entry>) => setEntries((cur) => ({ ...cur, [keyOf(l)]: { ...e, ...patch } }));

              return (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.product.name} {l.status !== "saleable" && <Badge tone="warn">{STATUS_LABEL[l.status]}</Badge>} {l.drifted && count.status !== "approved" && <Badge tone="bad">Stock moved</Badge>}</p>
                    <p className="text-xs text-ink-soft">{l.product.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{formatQty(l.expected_quantity, base, pack)}</td>
                  <td className="px-4 py-3 text-right">
                    {count.status === "counting" ? (
                      <div className="inline-flex items-center gap-1.5">
                        {pack && <input inputMode="numeric" aria-label={`${l.product.name} ${pack.name}s counted`} placeholder={pack.name + "s"} disabled={!editable} value={e.packs} onChange={(ev) => set({ packs: digits(ev.target.value) })} className={input} />}
                        <input inputMode="numeric" aria-label={`${l.product.name} ${base}s counted`} placeholder={pack ? `+ ${base}s` : base + "s"} disabled={!editable} value={e.loose} onChange={(ev) => set({ loose: digits(ev.target.value) })} className={input} />
                      </div>
                    ) : l.counted_quantity !== null ? formatQty(l.counted_quantity, base, pack) : "–"}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${diff ? (diff < 0 ? "text-[#c23a3a]" : "text-[#f40009]") : "text-ink-soft"}`}>
                    {diff === null ? "–" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="mt-4 rounded-2xl border border-line bg-surface shadow-sm p-4">
          <p className="mb-2 text-sm font-medium">Found something that is not listed?</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <ProductPicker value={addProduct} onChange={setAddProduct} label="Product" />
            <label className="text-sm font-medium">
              Status
              <select value={addStatus} onChange={(e) => setAddStatus(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-sm font-normal">
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <Button variant="secondary" disabled={!addProduct} busy={addLine.isPending} onClick={() => addLine.mutate()}>Add to sheet</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{error.message}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {editable && <Button variant="secondary" busy={save.isPending} onClick={() => save.mutate()}>Save progress</Button>}
        {editable && <Button busy={submit.isPending} disabled={done < lines.length || lines.length === 0} onClick={() => submit.mutate()}>Submit for approval</Button>}
        {count.status === "submitted" && s.can("inventory.approve") && <Button busy={act.isPending} onClick={() => act.mutate("approve")}>Approve and correct stock</Button>}
        {["counting", "submitted"].includes(count.status) && s.can("inventory.count") && (
          <Button variant="danger" busy={act.isPending} onClick={() => { if (window.confirm("Cancel this count? Nothing will change in stock.")) act.mutate("cancel"); }}>Cancel count</Button>
        )}
      </div>
    </>
  );
}

export default withSuspense(CountSheetPage);
