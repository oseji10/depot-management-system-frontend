"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { withSuspense } from "../../../../components/suspense-page";
import { Badge, Button, PageHeader, Pager, TableCard, TableEmpty, TableError, TableLoading, inputClass, theadClass, thClass } from "../../../../components/ui";
import { useIdParam } from "../../../../hooks/id-param";
import { useOptions } from "../../../../hooks/options";
import { api } from "../../../../lib/api";
import { formatDateTime } from "../../../../lib/format";
import { MOVEMENT_LABEL, STATUS_LABEL, formatQty } from "../../../../lib/units";

type Move = {
  id: number; at: string; type: string; status: string; quantity: number; before: number; after: number; reference: string | null; note: string | null;
  warehouse: string | null; user: string | null; source_type: string | null; source_id: number | null;
  product: { id: number; name: string; sku: string; base_unit: string | null; packs: { name: string; factor: number }[] } | null;
};
type Ledger = { data: Move[]; current_page: number; last_page: number; total: number; truncated?: boolean };

const label = (t: string) => MOVEMENT_LABEL[t] ?? t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const SOURCE: Record<string, string> = { Sale: "sale", SaleReturn: "return", GoodsReceipt: "receipt", StockTransfer: "transfer", StockAdjustment: "adjustment", StockCount: "count", Trip: "van trip" };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

function docLink(m: Move): string | null {
  if (!m.source_id) return null;
  switch (m.source_type) {
    case "Sale": return `/sales/view?id=${m.source_id}`;
    case "SaleReturn": return `/returns/view?id=${m.source_id}`;
    case "GoodsReceipt": return `/goods-receipts/view?id=${m.source_id}`;
    default: return null;
  }
}

/** "Mercy sold 4 Crates + 3 Bottles", the way the person would say it. */
function activity(m: Move): string {
  const n = formatQty(Math.abs(m.quantity), m.product?.base_unit ?? null, null, m.product?.packs);
  const who = m.user ?? "Someone";
  switch (m.type) {
    case "sale": return `${who} sold ${n}`;
    case "sale_void": return `${who} voided a sale, ${n} back`;
    case "sale_return": return `${who} took back ${n} from a customer`;
    case "receipt": return `${who} received ${n}`;
    case "receipt_reversal": return `${who} reversed a receipt of ${n}`;
    case "transfer_out": return `${who} sent out ${n}`;
    case "transfer_in": return `${who} received ${n} by transfer`;
    case "trip_issue": return `${who} loaded ${n} onto a van`;
    case "trip_return": return `${who} brought ${n} back from a van`;
    case "opening": return `Opening stock of ${n}`;
    default: return `${who}: ${label(m.type).toLowerCase()} of ${m.quantity < 0 ? "-" : "+"}${n}`;
  }
}

function csvCell(v: string | number | null) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

function HistoryPage() {
  const productId = useIdParam();
  const warehouses = useOptions("/warehouses");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(ymd(new Date()));
  const [warehouse, setWarehouse] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const qs = (extra = "") => {
    const p = new URLSearchParams({ from, to });
    if (productId) p.set("product_id", productId);
    if (warehouse) p.set("warehouse_id", warehouse);
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    if (term) p.set("q", term);
    return `${p.toString()}${extra}`;
  };
  const reset = () => { setFrom(daysAgo(29)); setTo(ymd(new Date())); setWarehouse(""); setType(""); setStatus(""); setSearch(""); setTerm(""); setPage(1); };

  const q = useQuery({
    queryKey: ["product-ledger", productId, from, to, warehouse, type, status, term, page],
    enabled: from <= to,
    queryFn: () => api<Ledger>(`/products/history?${qs(`&page=${page}`)}`),
    placeholderData: (prev) => prev,
  });
  const rows = q.data?.data ?? [];
  const forProduct = productId ? rows[0]?.product?.name : null;

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await api<Ledger>(`/products/history?${qs("&all=1")}`);
      const head = ["Product", "SKU", "Source", "Date", "Activity", "Condition", "Warehouse", "Reference", "Quantity before", "Quantity", "Quantity after"];
      const lines = all.data.map((m) => [m.product?.name ?? "", m.product?.sku ?? "", label(m.type), formatDateTime(m.at), activity(m), STATUS_LABEL[m.status] ?? m.status, m.warehouse ?? "", m.reference ?? "", m.before, m.quantity, m.after]);
      const csv = [head, ...lines].map((r) => r.map(csvCell).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = `product-history-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <p className="mb-2 text-sm"><Link href="/products" className="font-semibold text-[#f40009] hover:underline">← Products</Link></p>
      <PageHeader
        title={forProduct ? `History: ${forProduct}` : "Product history"}
        description="Every change to your stock, newest first: what moved, who did it, and the quantity before and after."
        action={<Button variant="secondary" busy={exporting} onClick={exportCsv}>Export CSV</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={reset} aria-label="Reset filters" className="grid size-11 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-sm hover:bg-paper">↺</button>
        <p className="mr-auto text-sm text-ink-soft">Showing {rows.length.toLocaleString("en-NG")} of {(q.data?.total ?? 0).toLocaleString("en-NG")} entries{productId && <> · <Link href="/products/history" className="font-semibold text-[#f40009] hover:underline">all products</Link></>}</p>
        <button type="button" onClick={() => setFilters((v) => !v)} aria-expanded={filters} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold shadow-sm hover:bg-paper">Filter{(warehouse || type || status) && " •"}</button>
        <form onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); setPage(1); }} className="flex">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or reference" aria-label="Search" className={`${inputClass} w-56 sm:w-64`} />
        </form>
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2 shadow-sm">
          <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From" className="min-h-10 bg-transparent text-sm" />
          <span className="text-ink-soft">–</span>
          <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To" className="min-h-10 bg-transparent text-sm" />
        </div>
      </div>

      {filters && (
        <div className="mb-3 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm sm:grid-cols-3">
          <label className="text-sm font-medium">Warehouse
            <select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setPage(1); }} className={`${inputClass} mt-1`}>
              <option value="">All warehouses</option>
              {warehouses.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Activity
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={`${inputClass} mt-1`}>
              <option value="">Everything</option>
              {Object.keys(MOVEMENT_LABEL).map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Condition
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inputClass} mt-1`}>
              <option value="">Any</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      )}

      <TableCard min="64rem">
        <thead className={theadClass}>
          <tr>
            <th className={thClass}>Product</th><th className={thClass}>Source</th><th className={thClass}>Date</th><th className={thClass}>Activity</th>
            <th className={`${thClass} text-right`}>Quantity before</th><th className={`${thClass} text-right`}>Quantity</th><th className={`${thClass} text-right`}>Quantity after</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isPending ? <TableLoading cols={7} /> : q.isError ? <TableError cols={7} message="Could not load the history." /> : rows.length === 0 ? <TableEmpty cols={7} title="No stock activity in this period" hint="Try a wider date range or clear the filters." /> : rows.map((m) => {
            const link = docLink(m);
            const unit = m.product?.base_unit ?? "";
            return (
              <tr key={m.id} className="align-top">
                <td className="px-4 py-3 font-medium">{m.product?.name ?? "–"}{m.status !== "saleable" && <> <Badge tone="warn">{STATUS_LABEL[m.status] ?? m.status}</Badge></>}<span className="block text-xs font-normal text-ink-soft">{m.warehouse}</span></td>
                <td className="px-4 py-3">{link ? <Link href={link} className="font-semibold text-[#128c4a] hover:underline">{m.reference ?? label(m.type)}</Link> : <span>{SOURCE[m.source_type ?? ""] ?? label(m.type)}</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDateTime(m.at)}</td>
                <td className="px-4 py-3">{activity(m)}{m.note && <span className="block text-xs italic text-ink-soft">“{m.note}”</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{m.before.toLocaleString("en-NG")}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${m.quantity < 0 ? "text-[#c23a3a]" : "text-green-700"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity.toLocaleString("en-NG")}<span className="block text-xs font-normal text-ink-soft">{unit}</span></td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{m.after.toLocaleString("en-NG")}</td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
      {q.data && <Pager page={page} last={q.data.last_page} total={q.data.total} current={q.data.current_page} setPage={setPage} />}
    </div>
  );
}

export default withSuspense(HistoryPage);
