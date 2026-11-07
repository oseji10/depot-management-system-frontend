"use client";

import { formatKobo } from "../lib/format";
import type { EmptiesRow } from "../lib/empties";
import type { EmptiesMode } from "../lib/types";

/** In the cart: containers going out, a stepper for empties handed back now, and the deposit this adds. */
export function EmptiesPanel({ rows, mode, onChange }: { rows: EmptiesRow[]; mode: EmptiesMode; onChange: (typeId: number, qty: number) => void }) {
  if (!rows.length) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-white p-3">
      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
        Empties {mode === "deposit" ? "· deposit" : "· on the customer's account"}
      </p>
      {rows.map((r) => (
        <div key={r.type.id} className="flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{r.type.name} <span className="text-ink-soft">× {r.sold}</span></p>
            <p className="text-xs text-ink-soft">
              {mode === "deposit"
                ? r.held > 0 ? `Deposit ${formatKobo(r.deposit)} (${formatKobo(r.type.deposit)} each)` : "Swapped for empties, no deposit"
                : `Customer will hold ${Math.max(r.held, 0)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center rounded-xl border border-line bg-white">
            <button type="button" aria-label={`One less ${r.type.name} handed back`} disabled={r.returned <= 0} onClick={() => onChange(r.type.id, r.returned - 1)} className="grid size-9 place-items-center text-ink-soft hover:text-ink disabled:opacity-30">−</button>
            <input
              aria-label={`${r.type.name} handed back`} inputMode="numeric" value={r.returned}
              onChange={(e) => onChange(r.type.id, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
              className="h-9 w-12 border-x border-line bg-transparent text-center text-sm font-semibold focus:outline-none"
            />
            <button type="button" aria-label={`One more ${r.type.name} handed back`} disabled={mode === "deposit" && r.returned >= r.sold} onClick={() => onChange(r.type.id, r.returned + 1)} className="grid size-9 place-items-center text-ink-soft hover:text-ink disabled:opacity-30">+</button>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-ink-soft">Number of empties the customer is handing back right now.</p>
    </div>
  );
}
