"use client";

import Link from "next/link";
import type { Warehouse } from "../lib/types";

/**
 * Shown before a sale can start: where is the stock coming from? Asking up front avoids filling in a whole sale
 * and only then being told to choose a warehouse.
 */
export function WarehouseGate({ warehouses, preferred, loading, onChoose, onClose, canAddWarehouse, canAddBranch }: { warehouses: Warehouse[]; preferred: number | null; loading: boolean; onChoose: (id: number) => void; onClose: () => void; canAddWarehouse: boolean; canAddBranch: boolean }) {
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Choose where to sell from" className="animate-rise max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Where are you selling from?</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-lg leading-none text-ink-soft hover:bg-line">×</button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">Choose the branch or warehouse whose stock this sale comes out of. You can change it later from the top of the till.</p>

        <ul className="mt-4 space-y-2">
          {loading && <li className="rounded-xl bg-paper px-4 py-6 text-center text-sm text-ink-soft">Loading…</li>}
          {!loading && warehouses.length === 0 && <li className="rounded-xl bg-amber-50 px-4 py-4 text-sm">No active warehouse is available to you. Ask an administrator to add one or give you access.</li>}
          {warehouses.map((w) => (
            <li key={w.id}>
              <button
                type="button" onClick={() => onChoose(w.id)}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${w.id === preferred ? "border-[#f40009] bg-[#fff5f5]" : "border-line bg-white hover:border-[#ff3b3f]/50"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{w.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{w.branch?.name ?? "Main depot"}{w.id === preferred ? " · last used" : ""}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-[#f40009]">Sell here →</span>
              </button>
            </li>
          ))}
        </ul>

        {(canAddWarehouse || canAddBranch || warehouses.length === 0) && (
          <p className="mt-4 text-sm text-ink-soft">
            Not listed?{" "}
            {canAddWarehouse && <Link href="/warehouses" onClick={onClose} className="font-semibold text-[#f40009] hover:underline">Add a warehouse</Link>}
            {canAddWarehouse && canAddBranch && " or "}
            {canAddBranch && <Link href="/branches" onClick={onClose} className="font-semibold text-[#f40009] hover:underline">add a branch</Link>}
            {!canAddWarehouse && !canAddBranch && "Ask an administrator to give you access to one."}
          </p>
        )}

        <button type="button" onClick={onClose} className="mt-4 min-h-12 w-full rounded-2xl border border-line bg-white font-semibold hover:bg-paper">OK, choose later</button>
      </div>
    </div>
  );
}
