"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Badge, Button, Field, Modal, PageHeader, TableLoading } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { useOptions } from "../../../hooks/options";
import { api } from "../../../lib/api";
import type { LowStockRow, OnHandRow, Paginated } from "../../../lib/types";
import { formatQty } from "../../../lib/units";

const selectClass = "min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm transition hover:border-[#ff3b3f]/40 focus:border-[#ff3b3f] focus:outline-none focus:ring-4 focus:ring-[#ff3b3f]/15";

export default function StockOnHandPage() {
  const s = useSession();
  const [view, setView] = useState<"all" | "low">("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<OnHandRow | null>(null);

  const warehouses = useOptions("/warehouses");
  const categories = useOptions("/product-categories");

  const all = useQuery({
    queryKey: ["list", "/stock/on-hand", page, deferred, warehouseId, categoryId],
    enabled: view === "all",
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (deferred) q.set("search", deferred);
      if (warehouseId) q.set("warehouse_id", warehouseId);
      if (categoryId) q.set("category_id", categoryId);
      return api<Paginated<OnHandRow>>(`/stock/on-hand?${q}`);
    },
  });

  const low = useQuery({
    queryKey: ["list", "/stock/low-stock"],
    enabled: view === "low",
    queryFn: () => api<{ data: LowStockRow[] }>("/stock/low-stock"),
  });

  const th = "px-4 py-2.5 font-medium";

  return (
    <>
      <PageHeader
        title="Stock on hand"
        description="What is in each warehouse right now, split into saleable, damaged and expired. Every figure comes from the stock ledger."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="View" className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-sm text-sm">
          {(["all", "low"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`rounded-lg px-3.5 py-2 ${view === v ? "bg-gradient-to-b from-[#ff3b3f] to-[#f40009] font-semibold text-white shadow-sm" : "text-ink-soft"}`}>
              {v === "all" ? "All stock" : "Low stock"}
            </button>
          ))}
        </div>

        {view === "all" && (
          <>
            <label className="sr-only" htmlFor="oh-wh">Warehouse</label>
            <select id="oh-wh" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">All warehouses</option>
              {warehouses.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="oh-cat">Category</label>
            <select id="oh-cat" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="oh-search">Search</label>
            <input id="oh-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or SKU" className={`${selectClass} min-w-48`} />
          </>
        )}
      </div>

      {view === "all" ? (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
                <tr>
                  <th scope="col" className={th}>Product</th>
                  <th scope="col" className={th}>Warehouse</th>
                  <th scope="col" className={`${th} text-right`}>Saleable</th>
                  <th scope="col" className={`${th} text-right`}>Damaged</th>
                  <th scope="col" className={`${th} text-right`}>Expired</th>
                  <th scope="col" className={`${th} text-right`}>Reorder at</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {all.isLoading && <TableLoading cols={7} />}
                {all.error && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#c23a3a]">{(all.error as Error).message}</td></tr>}
                {all.data?.data.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-soft">No stock recorded yet. Record your opening balances with an adjustment.</td></tr>
                )}
                {all.data?.data.map((r) => (
                  <tr key={`${r.warehouse.id}:${r.product.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.product.name} {r.is_low && <Badge tone="bad">Low</Badge>}</p>
                      <p className="text-xs text-ink-soft">{[r.product.sku, r.product.size_label, r.product.category].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3">{r.warehouse.name}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium">{formatQty(r.saleable, r.product.base_unit, r.product.pack)}</p>
                      {r.product.pack && r.saleable >= r.product.pack.factor && <p className="text-xs text-ink-soft">{r.saleable} {r.product.base_unit}s</p>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.damaged || <span className="text-ink-soft">–</span>}</td>
                    <td className="px-4 py-3 text-right">{r.expired || <span className="text-ink-soft">–</span>}</td>
                    <td className="px-4 py-3 text-right">{r.reorder_level ?? <span className="text-ink-soft">–</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {s.can("inventory.adjust") && (
                        <button onClick={() => setEditing(r)} className="font-semibold text-[#f40009] hover:underline">Reorder level</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {all.data && all.data.last_page > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
              <span>Page {all.data.current_page} of {all.data.last_page} · {all.data.total} total</span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="secondary" disabled={page >= all.data.last_page} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
              <tr>
                <th scope="col" className={th}>Product</th>
                <th scope="col" className={th}>Warehouse</th>
                <th scope="col" className={`${th} text-right`}>Saleable</th>
                <th scope="col" className={`${th} text-right`}>Reorder at</th>
                <th scope="col" className={`${th} text-right`}>Short by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {low.isLoading && <TableLoading cols={5} />}
              {low.data?.data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-soft">Nothing is below its reorder level. Set reorder levels from the All stock tab.</td></tr>
              )}
              {low.data?.data.map((r) => (
                <tr key={`${r.warehouse.id}:${r.product.id}`}>
                  <td className="px-4 py-3"><p className="font-medium">{r.product.name}</p><p className="text-xs text-ink-soft">{r.product.sku}</p></td>
                  <td className="px-4 py-3">{r.warehouse.name}</td>
                  <td className="px-4 py-3 text-right">{r.saleable}</td>
                  <td className="px-4 py-3 text-right">{r.min_quantity}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#c23a3a]">{r.shortfall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ReorderModal row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ReorderModal({ row, onClose }: { row: OnHandRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(row.reorder_level ? String(row.reorder_level) : "");

  const save = useMutation({
    mutationFn: () =>
      api("/stock/reorder-levels", {
        method: "PUT",
        body: { warehouse_id: row.warehouse.id, product_id: row.product.id, min_quantity: value === "" ? null : Number(value) },
      }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["list", "/stock/on-hand"] }); queryClient.invalidateQueries({ queryKey: ["list", "/stock/low-stock"] }); onClose(); },
  });

  return (
    <Modal title={`Reorder level: ${row.product.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label={`Warn me when saleable stock in ${row.warehouse.name} falls below`} inputMode="numeric" value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))} hint={`In ${row.product.base_unit ?? "base units"}. Leave empty to turn the alert off.`} />
        {save.error && <p role="alert" className="text-sm text-[#c23a3a]">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
