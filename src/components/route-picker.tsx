"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

type Group = { id: number; name: string; kind: string };

/** Tick the routes a van salesman covers. Routes are the customer groups of kind "route" (Customers → Groups). */
export function RoutePicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const q = useQuery({ queryKey: ["customer-groups", "routes"], queryFn: () => api<{ data: Group[] }>("/customer-groups") });
  const routes = (q.data?.data ?? []).filter((g) => g.kind === "route");

  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">Routes</legend>
      {q.isLoading ? <p className="text-xs text-ink-soft">Loading…</p> : routes.length === 0 ? (
        <p className="text-xs text-ink-soft">No routes yet. Make a customer group of type Route first, then come back.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {routes.map((g) => {
            const on = value.includes(g.id);
            return (
              <button key={g.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}
                className={`min-h-9 rounded-full border px-3 text-sm font-medium transition ${on ? "border-[#f40009] bg-[#ffe9ea] text-[#f40009]" : "border-line bg-white text-ink-soft hover:border-[#ff3b3f]/50"}`}>{g.name}</button>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 text-xs text-ink-soft">They see only the customers on these routes, and can load other routes from their phone. With none ticked they see every customer.</p>
    </fieldset>
  );
}
