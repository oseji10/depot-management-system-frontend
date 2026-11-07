"use client";

import { inputClass } from "./ui";
import type { TerminalChoice } from "../lib/types";

/** Which card machine took a card payment. With a single machine the choice is made for them. */
export function TerminalSelect({ terminals, value, onChange }: { terminals: TerminalChoice[]; value?: number; onChange: (id: number) => void }) {
  if (terminals.length === 0) return null;

  return (
    <div className="mt-1.5 flex items-center gap-2 pl-[6.5rem]">
      <label className="sr-only" htmlFor="terminal">Card terminal</label>
      <select
        id="terminal" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass} min-h-9 flex-1 py-1 text-sm ${value ? "" : "border-amber-400 bg-amber-50"}`}
      >
        {terminals.length > 1 && <option value="">Which terminal?</option>}
        {terminals.map((t) => <option key={t.id} value={t.id}>{t.name}{t.provider ? ` · ${t.provider}` : ""}</option>)}
      </select>
    </div>
  );
}

/** The terminal a payment row will use: the one picked, or the only one there is. */
export const terminalOf = (picked: number | undefined, terminals: TerminalChoice[]) => picked ?? (terminals.length === 1 ? terminals[0].id : undefined);
