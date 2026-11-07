"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../hooks/session";
import { api } from "../lib/api";
import { formatKobo } from "../lib/format";
import type { Customer, Paginated } from "../lib/types";
import { CustomerModal } from "./customer-form";
import { ICON, Svg, inputClass } from "./ui";

/** Walk-in by default; search by name or phone to pick someone; add a new customer without leaving the till. */
export function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const results = useQuery({
    queryKey: ["customers", "picker", term],
    enabled: open,
    queryFn: () => api<Paginated<Customer>>(`/customers?active=1&per_page=8&search=${encodeURIComponent(term)}`),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (c: Customer | null) => { onChange(c); setOpen(false); setTerm(""); };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-white px-3 text-left text-sm shadow-sm transition hover:border-[#ff3b3f]/40"
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${value ? "bg-[#ffe9ea] text-[#f40009]" : "bg-paper text-ink-soft"}`}>
          {value ? value.name.charAt(0).toUpperCase() : <Svg d={ICON.people} className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{value?.name ?? "Select or add customer"}</span>
          <span className="block truncate text-xs text-ink-soft">
            {value ? `${value.phone ?? "No phone"} · ${value.credit_limit ? `credit ${formatKobo(Math.max(value.credit_limit - (value.outstanding ?? 0), 0))} left` : "cash only"}` : "Or leave empty for a walk-in who pays now"}
          </span>
        </span>
        <Svg d={ICON.chevron} className="size-4 shrink-0 text-ink-soft" />
      </button>

      {open && (
        <div className="animate-rise absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          <div className="border-b border-line p-2.5">
            <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name or phone" aria-label="Search customers" className={`${inputClass} min-h-10`} />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            <li>
              <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#fff5f5]">
                <span className="grid size-8 place-items-center rounded-full bg-paper text-ink-soft"><Svg d={ICON.people} className="size-4" /></span>
                <span><span className="block font-semibold">Walk-in customer</span><span className="text-xs text-ink-soft">Pays in full now</span></span>
              </button>
            </li>
            {results.data?.data.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => pick(c)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#fff5f5]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffe9ea] text-xs font-bold text-[#f40009]">{c.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-ink-soft">{c.phone ?? "No phone"}</span>
                  </span>
                  {(c.outstanding ?? 0) > 0 && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 ring-inset">owes {formatKobo(c.outstanding ?? 0)}</span>}
                </button>
              </li>
            ))}
            {results.isLoading && <li className="px-3 py-3 text-sm text-ink-soft">Searching…</li>}
            {results.data && results.data.data.length === 0 && term && <li className="px-3 py-3 text-sm text-ink-soft">No customer matches “{term}”.</li>}
          </ul>
          {s.can("customers.manage") && (
            <button type="button" onClick={() => { setOpen(false); setAdding(true); }} className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-[#f40009] transition hover:bg-[#fff5f5]">
              <Svg d={ICON.plus} /> Add a new customer
            </button>
          )}
        </div>
      )}

      {adding && <CustomerModal onClose={() => setAdding(false)} onSaved={(c) => onChange({ ...c, outstanding: 0 })} />}
    </div>
  );
}
