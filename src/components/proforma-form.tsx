"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, api } from "../lib/api";
import { formatKobo, koboToInput, nairaToKobo } from "../lib/format";
import type { Customer, Proforma, ProformaCatalogueProduct } from "../lib/types";
import { CustomerPicker } from "./customer-picker";
import { Button, Field, inputClass } from "./ui";

type Row = { key: number; product_id: number; unit_id: number; quantity: string; price: string };

const today = () => new Date().toISOString().slice(0, 10);
let seq = 1;

/** Build or edit a proforma: who it is for, what is quoted, and how long the prices hold. */
export function ProformaForm({ existing }: { existing?: Proforma }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState(existing?.customer_name ?? "");
  const [phone, setPhone] = useState(existing?.customer_phone ?? "");
  const [email, setEmail] = useState(existing?.customer_email ?? "");
  const [address, setAddress] = useState(existing?.customer_address ?? "");
  const [issued, setIssued] = useState(existing?.issued_on ?? today());
  const [validUntil, setValidUntil] = useState(existing?.valid_until ?? "");
  const [discount, setDiscount] = useState(koboToInput(existing?.discount ?? 0));
  const [delivery, setDelivery] = useState(koboToInput(existing?.delivery_fee ?? 0));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [terms, setTerms] = useState(existing?.terms ?? "");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>(
    (existing?.lines ?? []).filter((l) => l.product_id).map((l) => ({ key: seq++, product_id: l.product_id as number, unit_id: l.unit_id, quantity: String(l.quantity), price: koboToInput(l.unit_price) })),
  );
  const [customerId, setCustomerId] = useState<number | null>(existing?.customer_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const catalogue = useQuery({ queryKey: ["proforma-catalogue"], queryFn: () => api<{ data: ProformaCatalogueProduct[] }>("/proformas/catalogue") });
  const products = useMemo(() => catalogue.data?.data ?? [], [catalogue.data]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const pick = (c: Customer | null) => {
    setCustomer(c);
    setCustomerId(c?.id ?? null);
    if (c) { setName(c.name); setPhone(c.phone ?? ""); setEmail(c.email ?? ""); setAddress(c.address ?? ""); }
  };

  const add = (p: ProformaCatalogueProduct) => {
    const u = p.units[0];
    setRows((r) => [...r, { key: seq++, product_id: p.id, unit_id: u.unit_id, quantity: "1", price: koboToInput(u.price) }]);
    setSearch("");
  };

  const patch = (key: number, change: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...change } : x)));

  const listOf = (row: Row) => byId.get(row.product_id)?.units.find((u) => u.unit_id === row.unit_id)?.price ?? 0;
  const subtotal = rows.reduce((t, r) => t + nairaToKobo(r.price) * (parseInt(r.quantity, 10) || 0), 0);
  const total = subtotal - nairaToKobo(discount) + nairaToKobo(delivery);

  const matches = search.trim() ? products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [];

  const save = useMutation({
    mutationFn: () => {
      const body = {
        customer_id: customerId, customer_name: name, customer_phone: phone || null, customer_email: email || null, customer_address: address || null,
        issued_on: issued, valid_until: validUntil || null, discount: nairaToKobo(discount), delivery_fee: nairaToKobo(delivery), notes: notes || null, terms: terms || null,
        lines: rows.map((r) => ({ product_id: r.product_id, unit_id: r.unit_id, quantity: parseInt(r.quantity, 10) || 0, unit_price: nairaToKobo(r.price) })),
      };
      return existing ? api<Proforma>(`/proformas/${existing.id}`, { method: "PUT", body }) : api<Proforma>("/proformas", { method: "POST", body });
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["list", "/proformas"] });
      queryClient.invalidateQueries({ queryKey: ["proforma"] });
      router.push(`/proformas/view?id=${existing?.id ?? p.id}`);
    },
    onError: (e: Error) => {
      setError(e.message);
      setFieldErrors(e instanceof ApiError ? (e.errors ?? {}) : {});
    },
  });

  const err = (k: string) => fieldErrors[k]?.[0];
  const lineErr = Object.entries(fieldErrors).filter(([k]) => k.startsWith("lines")).map(([, v]) => v[0]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); setFieldErrors({}); save.mutate(); }} className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 font-semibold">Who is it for?</h2>
        <CustomerPicker value={customer} onChange={pick} />
        <p className="mt-1 text-xs text-ink-soft">Pick a customer on file, or just type a prospect&apos;s details below. A customer on file is needed later to sell on credit.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={err("customer_name")} required />
          <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err("customer_email")} />
          <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 font-semibold">Items</h2>
        <div className="relative mb-3">
          <label htmlFor="pf-search" className="sr-only">Add a product</label>
          <input id="pf-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a product to add" autoComplete="off" className={inputClass} />
          {search.trim() && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
              {catalogue.isLoading && <li className="px-3 py-2 text-sm text-ink-soft">Loading…</li>}
              {!catalogue.isLoading && matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No product with a price matches.</li>}
              {matches.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p)} className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-paper">
                    {p.name} <span className="text-ink-soft">· {p.sku}{p.size_label ? ` · ${p.size_label}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rows.length === 0 && <p className="rounded-xl bg-paper px-3 py-6 text-center text-sm text-ink-soft">No items yet. Search above to add one.</p>}

        <div className="space-y-3">
          {rows.map((r) => {
            const p = byId.get(r.product_id);
            const below = nairaToKobo(r.price) < listOf(r);
            return (
              <div key={r.key} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{p?.name ?? "Product"} <span className="text-xs font-normal text-ink-soft">{p?.sku}</span></p>
                  <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="shrink-0 text-sm font-semibold text-[#f40009] hover:underline">Remove</button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Unit</label>
                    <select
                      value={r.unit_id}
                      onChange={(e) => { const u = p?.units.find((x) => x.unit_id === Number(e.target.value)); patch(r.key, { unit_id: Number(e.target.value), price: u ? koboToInput(u.price) : r.price }); }}
                      className={inputClass}
                    >
                      {p?.units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.name}</option>)}
                    </select>
                  </div>
                  <Field label="Quantity" type="number" min={1} inputMode="numeric" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} />
                  <Field label="Price (₦)" inputMode="decimal" value={r.price} onChange={(e) => patch(r.key, { price: e.target.value })} hint={`List ${formatKobo(listOf(r))}${below ? " · discounted" : ""}`} />
                  <div>
                    <span className="mb-1.5 block text-sm font-medium">Line total</span>
                    <p className="flex min-h-11 items-center font-semibold">{formatKobo(nairaToKobo(r.price) * (parseInt(r.quantity, 10) || 0))}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {lineErr.length > 0 && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{lineErr[0]}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 font-semibold">Terms</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} required />
          <Field label="Valid until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} error={err("valid_until")} hint="Leave empty if the prices do not expire." />
          <Field label="Discount (₦)" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} error={err("discount")} />
          <Field label="Delivery fee (₦)" inputMode="decimal" value={delivery} onChange={(e) => setDelivery(e.target.value)} error={err("delivery_fee")} />
        </div>
        <label className="mt-3 block text-sm font-medium">Notes (shown on the proforma)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} mt-1.5 py-2`} />
        </label>
        <label className="mt-3 block text-sm font-medium">Terms and payment details
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} placeholder="e.g. Payment before delivery. Account: …" className={`${inputClass} mt-1.5 py-2`} />
        </label>
      </section>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg">
        <div className="text-sm">
          <p className="text-ink-soft">Goods {formatKobo(subtotal)}{nairaToKobo(discount) > 0 ? ` − ${formatKobo(nairaToKobo(discount))}` : ""}{nairaToKobo(delivery) > 0 ? ` + ${formatKobo(nairaToKobo(delivery))} delivery` : ""}</p>
          <p className="text-lg font-bold">{formatKobo(total)}</p>
        </div>
        <div className="flex items-center gap-2">
          {error && !lineErr.length && <p role="alert" className="max-w-xs text-sm text-[#c23a3a]">{error}</p>}
          <Button type="submit" busy={save.isPending} disabled={rows.length === 0}>{existing ? "Save changes" : "Create proforma"}</Button>
        </div>
      </div>
    </form>
  );
}
