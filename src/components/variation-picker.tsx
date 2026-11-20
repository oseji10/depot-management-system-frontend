"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import type { Unit } from "../lib/types";
import { Button } from "./ui";

const NEW = "__new__";
const selectClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm shadow-sm focus:border-[#f40009] focus:outline-none";

/** All variations, shared by every picker on the page. */
export function useVariations() {
  return useQuery({
    queryKey: ["variations-all"],
    queryFn: async () => (await api<{ data: Unit[] }>("/units?per_page=200")).data,
    staleTime: 60_000,
  });
}

/**
 * Pick a variation from the Variations list, or create a new one on the spot (it then shows on the Variations page too).
 * Works by name, because the product form sends names.
 */
export function VariationPicker({ label, value, onPick, exclude = [], error, hint, required }: {
  label: string; value: string; onPick: (name: string, unit: Unit | null) => void; exclude?: string[]; error?: string; hint?: string; required?: boolean;
}) {
  const qc = useQueryClient();
  const { data: units = [] } = useVariations();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [size, setSize] = useState("");

  const lower = value.trim().toLowerCase();
  const hidden = exclude.map((x) => x.trim().toLowerCase()).filter((x) => x && x !== lower);
  const choices = units.filter((u) => !hidden.includes(u.name.toLowerCase()));
  const current = units.find((u) => u.name.toLowerCase() === lower);

  const create = useMutation({
    mutationFn: () => api<Unit>("/units", { method: "POST", body: { name: name.trim(), usual_size: size ? Number(size) : null } }),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ["variations-all"] });
      void qc.invalidateQueries({ queryKey: ["select-options", "/units"] });
      void qc.invalidateQueries({ queryKey: ["list", "/units"] });
      onPick(u.name, u);
      setAdding(false); setName(""); setSize("");
    },
  });

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}{required && <span className="text-[#f40009]"> *</span>}</label>
      {!adding ? (
        <select
          className={selectClass}
          value={current ? String(current.id) : value ? `name:${value}` : ""}
          onChange={(e) => {
            if (e.target.value === NEW) { setAdding(true); setName(""); return; }
            const u = units.find((x) => String(x.id) === e.target.value) ?? null;
            onPick(u?.name ?? "", u);
          }}
        >
          <option value="">Choose a variation…</option>
          {value && !current && <option value={`name:${value}`}>{value}</option>}
          {choices.map((u) => <option key={u.id} value={u.id}>{u.name}{u.usual_size && u.usual_size > 1 ? ` (${u.usual_size})` : ""}</option>)}
          <option value={NEW}>+ New variation…</option>
        </select>
      ) : (
        <div className="space-y-2 rounded-xl border border-[#f40009]/40 bg-[#fff8f8] p-2.5">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Half crate" className={selectClass}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (name.trim()) create.mutate(); } }} />
          <input value={size} onChange={(e) => setSize(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Usual size (optional), e.g. 12" className={selectClass} />
          {create.error && <p className="text-xs text-[#c23a3a]">{(create.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="button" busy={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>Create</Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {error ? <p role="alert" className="mt-1 text-xs text-[#c23a3a]">{error}</p> : hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
