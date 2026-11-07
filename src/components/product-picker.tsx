"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useId, useState } from "react";
import { api } from "../lib/api";
import type { Paginated, Product } from "../lib/types";

/** Type to search active products by name, SKU or brand. */
export function ProductPicker({ value, onChange, label = "Product" }: {
  value: Product | null;
  onChange: (product: Product | null) => void;
  label?: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text.trim());

  const results = useQuery({
    queryKey: ["product-picker", deferred],
    enabled: deferred.length > 0 && !value,
    queryFn: () => api<Paginated<Product>>(`/products?per_page=8&status=active&search=${encodeURIComponent(deferred)}`),
  });

  if (value) {
    return (
      <div>
        <span className="mb-1 block text-sm font-medium">{label}</span>
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 text-sm">
          <span className="truncate">{value.name} <span className="text-ink-soft">· {value.sku}</span></span>
          <button type="button" onClick={() => { onChange(null); setText(""); }} className="shrink-0 text-[#f40009] hover:underline">Change</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search by name or SKU"
        autoComplete="off"
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
      />
      {deferred && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
          {results.isLoading && <li className="px-3 py-2 text-sm text-ink-soft">Searching…</li>}
          {results.data?.data.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No matching products.</li>}
          {results.data?.data.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-paper">
                {p.name} <span className="text-ink-soft">· {p.sku}{p.size_label ? ` · ${p.size_label}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
