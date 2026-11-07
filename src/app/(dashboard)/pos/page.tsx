"use client";

import { useInView } from "../../../hooks/in-view";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { focusIfDesktop } from "../../../lib/focus";
import { WarehouseGate } from "../../../components/warehouse-gate";
import { FieldPos } from "../../../components/field-pos";
import { CustomerPicker } from "../../../components/customer-picker";
import { MixBuilder, type MixPick } from "../../../components/mix-builder";
import { Button, ErrorNote, FilterSelect, ICON, Modal, Svg, filterClass, inputClass } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatKobo, koboToInput, nairaToKobo } from "../../../lib/format";
import { CHANNEL_LABEL, METHOD_PAY_LABEL } from "../../../lib/status";
import { TerminalSelect, terminalOf } from "../../../components/terminal-select";
import { TransferTarget, transferPayload, transferReady, type TransferValue } from "../../../components/transfer-target";
import { WhatsAppButton } from "../../../components/whatsapp-button";
import { usePayTo } from "../../../hooks/pay-to";
import { saleMessage } from "../../../lib/share";
import { EmptiesPanel } from "../../../components/empties-panel";
import { emptiesPayload, emptiesPlan } from "../../../lib/empties";
import { ProductThumb } from "../../../components/product-image";
import type { Customer, MyVan, Paginated, PosCatalogue, PosProduct, PosUnit, Sale, Warehouse, MixLayoutChoice } from "../../../lib/types";

type CartLine = { key: string; product: PosProduct; unit: PosUnit; qty: number; price: number; mix?: { layoutId: number; group: string; label: string } };
type Method = keyof typeof METHOD_PAY_LABEL;
type PayRow = { id: number; method: Method; amount: string | null; terminal?: number; transfer?: TransferValue }; // null = "whatever is still owed"

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function stockText(p: PosProduct) {
  const base = p.units.find((u) => u.factor === 1)?.name ?? "units";
  const big = p.units[p.units.length - 1];
  const crates = big && big.factor > 1 && p.stock >= big.factor ? ` · ${Math.floor(p.stock / big.factor)} ${big.name}` : "";
  return `${p.stock.toLocaleString("en-NG")} ${base}${crates}`;
}

export default function PosPage() {
  const s = useSession();
  // Salespeople use the offline-first till; it is a different screen with the same look.
  if (s.van) return <FieldPos />;
  return <CounterPos />;
}

function CounterPos() {
  const s = useSession();
  const payTo = usePayTo();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef(uid());

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false); // closed the chooser without picking; the till stays empty until they do
  const [chosen, setChosen] = useState(false); // the person has said where they sell from, this visit
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const cartInView = useInView("cart");
  const [mixing, setMixing] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [channel, setChannel] = useState<keyof typeof CHANNEL_LABEL>("counter");
  const [rows, setRows] = useState<PayRow[]>([]);
  const [credit, setCredit] = useState(false); // the unpaid rest goes on the customer's account
  const [returned, setReturned] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [done, setDone] = useState<{ sale: Sale; change: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Salespeople sell from their own van only; everyone else picks a warehouse.
  const warehouses = useQuery({ queryKey: ["pos", "warehouses"], enabled: !s.van, queryFn: () => api<Paginated<Warehouse>>("/warehouses?per_page=100") });
  const myVan = useQuery({ queryKey: ["field", "me"], enabled: !!s.van, queryFn: () => api<MyVan>("/field/me"), refetchInterval: 30_000 });
  const noLoad = !!s.van && !myVan.isLoading && !myVan.data?.report;

  const activeWarehouses = warehouses.data?.data.filter((w) => w.is_active) ?? [];
  let saved: number | null = null;
  try { saved = Number(localStorage.getItem("pos.warehouse")) || null; } catch { /* private mode */ }
  const preferred = activeWarehouses.find((w) => w.id === saved)?.id ?? null;

  const choose = (id: number) => {
    setWarehouseId(id);
    setChosen(true);
    try { localStorage.setItem("pos.warehouse", String(id)); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (s.van) { if (warehouseId !== s.van.id) setWarehouseId(s.van.id); return; }
    // Only one place to sell from: nothing to ask.
    if (!chosen && warehouses.data && activeWarehouses.length === 1) choose(activeWarehouses[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses.data, chosen, s.van]);

  const catalogue = useQuery({
    queryKey: ["pos", warehouseId], enabled: !!warehouseId,
    queryFn: () => api<PosCatalogue>(`/pos/catalogue?warehouse_id=${warehouseId}`),
  });

  const canDiscount = s.can("sales.discount");

  // ---- derived money ----
  const terminals = catalogue.data?.terminals ?? [];
  const accounts = catalogue.data?.transfer_accounts ?? [];
  const goods = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const mode = customer?.empties_mode ?? "deposit";
  const plan = useMemo(() => emptiesPlan(cart, catalogue.data?.containers ?? [], mode, returned), [cart, catalogue.data, mode, returned]);
  const total = goods + plan.deposit; // what the customer owes: goods plus container deposit
  const listTotal = cart.reduce((n, l) => n + l.unit.price * l.qty, 0) + plan.deposit;
  const resolved = useMemo(() => {
    const fixed = rows.reduce((n, r) => n + (r.amount === null ? 0 : nairaToKobo(r.amount)), 0);
    return rows.map((r) => ({ ...r, kobo: r.amount === null ? Math.max(total - fixed, 0) : nairaToKobo(r.amount) }));
  }, [rows, total]);
  const paid = resolved.reduce((n, r) => n + r.kobo, 0);
  const remaining = Math.max(total - paid, 0);
  const change = Math.max(paid - total, 0);
  const cashRow = resolved.filter((r) => r.method === "cash" && r.kobo >= change).sort((a, b) => b.kobo - a.kobo)[0];

  // ---- stock check across lines of the same product ----
  const need = new Map<number, number>();
  cart.forEach((l) => need.set(l.product.id, (need.get(l.product.id) ?? 0) + l.qty * l.unit.factor));
  const short = (l: CartLine) => (need.get(l.product.id) ?? 0) > l.product.stock;
  const anyShort = cart.some(short);

  const blocker =
    !cart.length ? "Add products to start a sale"
    : anyShort ? "Some items are more than what is in stock"
    : remaining > 0 && !credit ? (rows.length ? `${formatKobo(remaining)} still to allocate: add another payment or put it on credit` : "Choose how the customer is paying")
    : remaining > 0 && !customer ? "Choose a customer to sell on credit"
    : change > 0 && !cashRow ? "Only cash can be given back as change"
    : terminals.length > 0 && resolved.some((r) => r.method === "pos" && r.kobo > 0 && !terminalOf(r.terminal, terminals)) ? "Choose the card terminal"
    : resolved.some((r) => r.method === "transfer" && r.kobo > 0 && !transferReady({ ...r.transfer, to: r.transfer?.to ?? (terminals.length ? undefined : "account") }, terminals, r.terminal)) ? "Choose where the bank transfer was paid"
    : null;

  function add(p: PosProduct, u: PosUnit) {
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id && l.unit.product_unit_id === u.product_unit_id);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key: uid(), product: p, unit: u, qty: 1, price: u.price }];
    });
    setSearch("");
    focusIfDesktop(searchRef.current);
  }

  const setQty = (key: string, qty: number) => setCart((c) => c.map((l) => (l.key === key && !l.mix ? { ...l, qty: Math.max(1, Math.min(100000, qty || 1)) } : l)));
  const remove = (key: string) => setCart((c) => c.filter((l) => l.key !== key));
  function addMix(layout: MixLayoutChoice, picks: MixPick[]) {
    const group = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    setCart((c) => [...c, ...picks.map((k) => ({ key: uid(), product: k.product, unit: k.unit, qty: k.qty, price: k.unit.price, mix: { layoutId: layout.id, group, label: layout.name } }))]);
    setMixing(false);
  }
  const removeLine = (l: CartLine) => setCart((c) => c.filter((x) => (l.mix ? x.mix?.group !== l.mix.group : x.key !== l.key)));


  /** Paying part now and the rest another way: empty the first amount so the person can type the part, and the other buttons appear. */
  function startSplit() {
    setRows((r) => r.map((x, i) => (i === 0 ? { ...x, amount: "" } : x)));
    setTimeout(() => document.getElementById("pay-first")?.focus(), 50);
  }

  function addPayment(method: Method) {
    if (remaining === 0 && rows.length) return;
    if (!rows.length) setCredit(false);
    // lock the amount of an auto row so the new row can take what is left
    setRows((r) => [...r.map((x) => (x.amount === null ? { ...x, amount: koboToInput(resolved.find((q) => q.id === x.id)?.kobo ?? 0) } : x)), { id: Date.now(), method, amount: null }]);
  }

  function reset() {
    setCart([]); setRows([]); setCredit(false); setReturned({}); setCustomer(null); setChannel("counter"); setErrors({});
    clientRef.current = uid();
    focusIfDesktop(searchRef.current);
  }

  const sell = useMutation({
    mutationFn: () => {
      let giveBack = change;
      const payments = resolved.filter((r) => r.kobo > 0).map((r) => {
        const cut = giveBack > 0 && r.id === cashRow?.id ? giveBack : 0;
        giveBack -= cut;
        return {
          method: r.method, amount: r.kobo - cut,
          ...(r.method === "pos" && terminalOf(r.terminal, terminals) ? { pos_terminal_id: terminalOf(r.terminal, terminals) } : {}),
          ...(r.method === "transfer" ? transferPayload({ ...r.transfer, to: r.transfer?.to ?? (terminals.length ? undefined : "account") }, terminals, r.terminal) : {}),
        };
      }).filter((p) => p.amount > 0);

      return api<Sale>("/sales", {
        method: "POST",
        body: {
          warehouse_id: warehouseId, customer_id: customer?.id ?? null, channel, client_ref: clientRef.current,
          lines: cart.map((l) => ({ product_id: l.product.id, unit_id: l.unit.unit_id, quantity: l.qty, ...(l.price !== l.unit.price ? { unit_price: l.price } : {}), ...(l.mix ? { mix_layout_id: l.mix.layoutId, mix_group: l.mix.group } : {}) })),
          payments, empties_returned: emptiesPayload(plan.rows),
        },
      });
    },
    onSuccess: (sale) => {
      setDone({ sale, change });
      reset();
      queryClient.invalidateQueries({ queryKey: ["pos"] });
      queryClient.invalidateQueries({ queryKey: ["field"] });
      queryClient.invalidateQueries({ queryKey: ["list", "/sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => {
      setErrors(e instanceof ApiError ? (e.errors ?? {}) : {});
      queryClient.invalidateQueries({ queryKey: ["pos"] }); // stock may have changed under us
    },
  });

  // ---- product grid ----
  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (catalogue.data?.products ?? []).filter(
      (p) => (!category || p.category_id === category) && (!term || `${p.name} ${p.sku} ${p.size_label ?? ""} ${p.brand ?? ""}`.toLowerCase().includes(term)),
    );
  }, [catalogue.data, search, category]);

  const categories = useMemo(() => {
    const used = new Set(catalogue.data?.products.map((p) => p.category_id));
    return (catalogue.data?.categories ?? []).filter((c) => used.has(c.id));
  }, [catalogue.data]);

  /** A scanner types the barcode then presses Enter. */
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !search.trim()) return;
    for (const p of catalogue.data?.products ?? []) {
      const u = p.units.find((x) => x.barcode && x.barcode === search.trim());
      if (u) return add(p, u);
    }
    if (products.length === 1 && products[0].units.length === 1) add(products[0], products[0].units[0]);
  }

  const warehouseList: Warehouse[] = s.van
    ? [{ id: s.van.id, name: s.van.name, code: "VAN", is_default: true, is_active: true, branch_id: s.branch?.id ?? 0 }]
    : (warehouses.data?.data.filter((w) => w.is_active) ?? []);
  const errorText = Object.values(errors).flat()[0] ?? (sell.error && !Object.keys(errors).length ? (sell.error as Error).message : null);
  const items = cart.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      {!s.van && !chosen && !dismissed && activeWarehouses.length !== 1 && <WarehouseGate warehouses={activeWarehouses} preferred={preferred} loading={warehouses.isLoading} onChoose={choose} onClose={() => setDismissed(true)} canAddWarehouse={s.can("warehouses.create")} canAddBranch={s.can("branches.create")} />}
      {mixing && <MixBuilder layouts={catalogue.data?.mix_layouts ?? []} products={catalogue.data?.products ?? []} used={need} onAdd={addMix} onClose={() => setMixing(false)} />}
      {/* ---------- Products ---------- */}
      <section aria-label="Products" className="min-w-0 pb-24 xl:pb-0">
        <div className="sticky top-[3.25rem] z-20 -mx-4 mb-4 space-y-3 bg-paper/90 px-4 pt-1 pb-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-5 lg:px-5">
          {!s.van && !warehouseId && (
            <button type="button" onClick={() => setDismissed(false)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#f40009]/30 bg-[#fff5f5] px-4 text-left text-sm font-semibold text-[#c40008]">
              <span>Choose where you are selling from to start</span><span>Choose →</span>
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-60 flex-1">
              <Svg d={ICON.search} className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" />
              <input
                ref={searchRef} enterKeyHint="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey}
                placeholder="Search products or scan a barcode" aria-label="Search products or scan a barcode"
                className={`${filterClass} min-h-12 w-full pr-10 pl-10 text-[15px]`}
              />
              <Svg d={ICON.barcode} className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-ink-soft/60" />
            </div>
            {warehouseList.length > 1 && (
              <select
                aria-label="Selling from" value={warehouseId ?? ""} className={`${filterClass} min-h-12`}
                onChange={(e) => { choose(Number(e.target.value)); setCart([]); }}
              >
                {!warehouseId && <option value="" disabled>Choose…</option>}
                {warehouseList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
            {warehouseList.length === 1 && <span className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1 text-[13px] font-medium whitespace-nowrap text-ink-soft">{warehouseList[0].name}</span>}
          </div>

          {(catalogue.data?.mix_layouts ?? []).length > 0 && (
            <div>
              <Button type="button" variant="secondary" onClick={() => setMixing(true)}>Mixed crate</Button>
            </div>
          )}
          <div className="-mx-1 flex gap-2 relative overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Categories">
            {[{ id: 0, name: "All" }, ...categories].map((c) => (
              <button
                key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                className={`min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition ${
                  category === c.id ? "border-[#f40009] bg-[#f40009] text-white shadow-sm" : "border-line bg-white text-ink-soft hover:border-[#ff3b3f]/40 hover:text-ink"
                }`}
              >{c.name}</button>
            ))}
          </div>
        </div>

        {!!catalogue.data?.unpriced?.length && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {catalogue.data.unpriced.length} product{catalogue.data.unpriced.length > 1 ? "s" : ""} in stock cannot be sold yet because {catalogue.data.unpriced.length > 1 ? "they have" : "it has"} no price: {catalogue.data.unpriced.slice(0, 4).map((u) => u.name).join(", ")}{catalogue.data.unpriced.length > 4 ? "…" : ""}.{" "}
            {catalogue.data.unpriced.slice(0, 3).map((u) => u.why && <span key={u.id} className="block">{u.name}: {u.why}</span>)}
            <Link href="/price-lists" className="font-semibold underline">Set prices</Link>
          </p>
        )}
        {catalogue.isLoading || warehouses.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-line" />)}
          </div>
        ) : catalogue.error ? (
          <ErrorNote>{(catalogue.error as Error).message}</ErrorNote>
        ) : noLoad ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]"><Svg d={ICON.box} className="size-7" /></span>
            <p className="mt-4 font-semibold">No stock has been issued to you</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Ask the warehouse to load your van. Once they do, your products appear here.</p>
          </div>
        ) : !warehouseList.length ? (
          <ErrorNote>No warehouse is available to sell from. Ask an administrator to set one up.</ErrorNote>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]"><Svg d={ICON.search} className="size-7" /></span>
            <p className="mt-4 font-semibold">{catalogue.data?.products.length ? "Nothing matches your search" : "No products have a price yet"}</p>
            {!catalogue.data?.products.length && <p className="mt-1 text-sm text-ink-soft">Set prices in <Link href="/price-lists" className="font-semibold text-[#f40009] hover:underline">Price lists</Link> so products can be sold.</p>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => {
              const inCart = cart.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.qty * l.unit.factor, 0);
              const left = p.stock - inCart;
              const low = left <= 0;
              return (
                <div key={p.id} className={`flex flex-col rounded-2xl border bg-surface p-4 shadow-sm transition ${low ? "border-line opacity-70" : "border-line hover:border-[#ff3b3f]/40 hover:shadow-md"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <ProductThumb url={p.image_url} name={p.name} className="size-12 rounded-xl" fallbackClass="bg-[#ffe9ea] text-[#f40009] ring-[#ff3b3f]/20" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 leading-snug font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{[p.size_label, p.sku].filter(Boolean).join(" · ")}</p>
                    </div>
                    {inCart > 0 && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f40009] text-xs font-bold text-white" title="In this sale">{cart.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.qty, 0)}</span>}
                  </div>
                  <p className={`mt-2 text-xs font-medium ${p.stock <= 0 ? "text-[#c23a3a]" : "text-ink-soft"}`}>{p.stock <= 0 ? "Out of stock" : stockText(p)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 pt-1">
                    {p.units.map((u) => (
                      <button
                        key={u.product_unit_id} type="button" onClick={() => add(p, u)} disabled={left < u.factor}
                        className="group flex min-h-11 flex-1 basis-24 flex-col items-start rounded-xl border border-line bg-[#fff5f5] px-3 py-1.5 text-left transition hover:border-[#ff3b3f] hover:bg-[#ffe9ea] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-[#fff5f5]"
                      >
                        <span className="text-[11px] font-medium text-ink-soft">{u.name}{u.factor > 1 ? ` of ${u.factor}` : ""}</span>
                        <span className="text-sm font-bold text-[#a50006]">{formatKobo(u.price)}</span>
                        {u.is_promo && u.original_price && <span className="text-[10px] text-ink-soft line-through">{formatKobo(u.original_price)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Cart ---------- */}
      <aside id="cart" aria-label="Current sale" className="mb-20 flex flex-col rounded-3xl border border-line bg-surface shadow-lg shadow-black/5 xl:sticky xl:top-3 xl:mb-0 xl:h-[calc(100dvh-1.5rem)] xl:overflow-hidden">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Current sale {items > 0 && <span className="ml-1 text-sm font-medium text-ink-soft">· {items} item{items === 1 ? "" : "s"}</span>}</h2>
            {cart.length > 0 && <button type="button" onClick={reset} className="text-sm font-semibold text-[#c23a3a] hover:underline">Clear</button>}
          </div>
          <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setErrors({}); }} />
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="channel" className="text-ink-soft">Order type</label>
            <FilterSelect id="channel" label="Order type" value={channel} onChange={(v) => setChannel(v as keyof typeof CHANNEL_LABEL)}>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </FilterSelect>
          </div>
        </div>

        <div className="min-h-40 flex-1 p-2 xl:min-h-24 xl:overflow-y-auto">
          {cart.length === 0 ? (
            <div className="grid h-full place-items-center px-6 py-10 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]"><Svg d={ICON.cart} className="size-7" /></span>
                <p className="mt-4 font-semibold">The cart is empty</p>
                <p className="mt-1 text-sm text-ink-soft">Tap a price on any product to add it.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {cart.map((l) => l.mix ? (
                <li key={l.key} className="rounded-2xl p-3 hover:bg-[#fff5f5]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.product.name}</p>
                      <p className="text-xs font-semibold text-[#f40009]">Mixed crate · {l.mix.label}</p>
                      <p className="text-xs text-ink-soft">{l.qty} {l.unit.name.toLowerCase()}s × {formatKobo(l.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatKobo(l.price * l.qty)}</p>
                      <button type="button" onClick={() => removeLine(l)} aria-label={`Remove mixed crate with ${l.product.name}`} className="mt-1 text-xs font-semibold text-[#c23a3a] hover:underline">Remove crate</button>
                    </div>
                  </div>
                </li>
              ) : (
                <li key={l.key} className={`rounded-2xl p-3 ${short(l) ? "bg-red-50" : "hover:bg-[#fff5f5]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.product.name}</p>
                      <p className="text-xs text-ink-soft">{l.unit.name}{l.unit.factor > 1 ? ` of ${l.unit.factor}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => remove(l.key)} aria-label={`Remove ${l.product.name}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-red-50 hover:text-[#c23a3a]"><Svg d={ICON.x} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-xl border border-line bg-white">
                      <button type="button" aria-label="One less" onClick={() => (l.qty > 1 ? setQty(l.key, l.qty - 1) : remove(l.key))} className="grid size-9 place-items-center text-ink-soft hover:text-ink"><Svg d={ICON.minus} /></button>
                      <input aria-label={`Quantity of ${l.product.name}`} inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.key, parseInt(e.target.value.replace(/\D/g, ""), 10))} className="h-9 w-12 border-x border-line bg-transparent text-center text-sm font-semibold focus:outline-none" />
                      <button type="button" aria-label="One more" onClick={() => setQty(l.key, l.qty + 1)} className="grid size-9 place-items-center text-ink-soft hover:text-ink"><Svg d={ICON.plus} /></button>
                    </div>
                    <div className="text-right">
                      {editing === l.key ? (
                        <input
                          autoFocus aria-label="Price per unit" inputMode="decimal" defaultValue={koboToInput(l.price)} className={`${inputClass} min-h-9 w-28 text-right`}
                          onBlur={(e) => { const k = nairaToKobo(e.target.value); setCart((c) => c.map((x) => (x.key === l.key ? { ...x, price: k > 0 && k <= x.unit.price ? k : x.unit.price } : x))); setEditing(null); }}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <button type="button" disabled={!canDiscount} onClick={() => setEditing(l.key)} title={canDiscount ? "Change the price" : undefined} className={`text-sm font-bold ${canDiscount ? "hover:text-[#f40009] hover:underline" : "cursor-default"}`}>
                          {formatKobo(l.price * l.qty)}
                        </button>
                      )}
                      <p className="text-[11px] text-ink-soft">
                        {l.price < l.unit.price && <span className="mr-1 line-through">{formatKobo(l.unit.price)}</span>}{formatKobo(l.price)} each
                      </p>
                    </div>
                  </div>
                  {short(l) && <p className="mt-2 text-xs font-semibold text-[#c23a3a]">Only {stockText(l.product)} in stock</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totals and payment */}
        <div className="space-y-3 border-t border-line bg-[#fbfdfc] p-4 xl:max-h-[62%] xl:shrink-0 xl:overflow-y-auto xl:overscroll-contain">
          <EmptiesPanel rows={plan.rows} mode={mode} onChange={(id, q) => setReturned((r) => ({ ...r, [id]: Math.max(0, q) }))} />
          {listTotal > total && <div className="flex justify-between text-sm text-ink-soft"><span>Discount</span><span>−{formatKobo(listTotal - total)}</span></div>}
          {plan.deposit > 0 && <div className="flex justify-between text-sm text-ink-soft"><span>Goods</span><span>{formatKobo(goods)}</span></div>}
          {plan.deposit > 0 && <div className="flex justify-between text-sm text-ink-soft"><span>Container deposit</span><span>{formatKobo(plan.deposit)}</span></div>}
          <div className="flex items-baseline justify-between"><span className="text-sm font-medium text-ink-soft">Total</span><span className="text-3xl font-bold tracking-tight">{formatKobo(total)}</span></div>

          {cart.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">How is the customer paying?</p>
                {rows.length === 1 && remaining === 0 && change === 0 && (
                  <button type="button" onClick={startSplit} className="text-xs font-semibold text-[#f40009] hover:underline">Split payment</button>
                )}
              </div>

              {resolved.map((r, i) => (
                <div key={r.id} className="rounded-xl border border-line bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-sm font-semibold">{METHOD_PAY_LABEL[r.method]}</span>
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-soft" aria-hidden="true">₦</span>
                      <input
                        id={i === 0 ? "pay-first" : undefined} placeholder="0"
                        aria-label={`${METHOD_PAY_LABEL[r.method]} amount`} inputMode="decimal" value={rows.find((x) => x.id === r.id)?.amount ?? koboToInput(r.kobo)}
                        onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, amount: e.target.value.replace(/[^0-9.,]/g, "") } : x)))}
                        className={`${inputClass} min-h-10 pl-7 text-right font-semibold`}
                      />
                    </div>
                    <button type="button" aria-label={`Remove ${METHOD_PAY_LABEL[r.method]} payment`} onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))} className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-red-50 hover:text-[#c23a3a]"><Svg d={ICON.x} /></button>
                  </div>
                  {r.method === "transfer" && (
                    <TransferTarget accounts={accounts} terminals={terminals} value={rows.find((x) => x.id === r.id)?.transfer ?? {}} terminal={rows.find((x) => x.id === r.id)?.terminal}
                      onChange={(v) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, transfer: v } : x)))}
                      onTerminal={(id) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, terminal: id } : x)))} />
                  )}
                  {r.method === "pos" && <TerminalSelect terminals={terminals} value={terminalOf(rows.find((x) => x.id === r.id)?.terminal, terminals)} onChange={(id) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, terminal: id } : x)))} />}
                </div>
              ))}

              {credit && remaining > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800">
                  <span>On credit{customer ? ` · ${customer.name}` : ""}</span>
                  <span className="flex items-center gap-2">{formatKobo(remaining)}
                    <button type="button" aria-label="Remove credit" onClick={() => setCredit(false)} className="grid size-7 place-items-center rounded-lg hover:bg-amber-100"><Svg d={ICON.x} /></button>
                  </span>
                </div>
              )}

              {remaining > 0 && !credit && rows.length > 0 && (
                <p className="flex justify-between rounded-xl bg-[#ffe9ea] px-3 py-2.5 text-sm font-bold text-[#a50006]"><span>Still to allocate</span><span>{formatKobo(remaining)}</span></p>
              )}

              {remaining > 0 && !credit && (
                <div>
                  <p className="mb-1.5 text-xs text-ink-soft">{rows.length ? "Pay the rest with:" : "Tap how it is paid. To pay part one way and part another, tap one, then Split payment."}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(METHOD_PAY_LABEL) as Method[]).map((m) => (
                      <button key={m} type="button" onClick={() => addPayment(m)} className="min-h-11 rounded-xl border border-line bg-white px-2 text-[13px] font-semibold shadow-sm transition hover:border-[#ff3b3f] hover:bg-[#ffe9ea] active:scale-[0.97]">
                        {rows.length ? "+ " : ""}{METHOD_PAY_LABEL[m]}
                      </button>
                    ))}
                    <button type="button" onClick={() => setCredit(true)} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-2 text-[13px] font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 active:scale-[0.97]">
                      {rows.length ? "+ " : ""}{rows.length ? "Rest on credit" : "On credit"}
                    </button>
                  </div>
                </div>
              )}

              {change > 0 && <p className="flex justify-between rounded-xl bg-[#ffe9ea] px-3 py-2.5 text-sm font-bold text-[#a50006]"><span>Change to give</span><span>{formatKobo(change)}</span></p>}
              {rows.length > 0 && remaining === 0 && change === 0 && <p className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800"><span>Fully paid</span><span>{formatKobo(total)}</span></p>}
            </div>
          )}

          {errorText && <ErrorNote>{errorText}</ErrorNote>}
          {blocker && cart.length > 0 && <p className="text-xs font-medium text-amber-700">{blocker}</p>}

        </div>

        {/* The charge bar never scrolls away: it sticks to the bottom of the screen on phones and tablets, and to the bottom of the panel on wide screens. */}
        <div className="sticky bottom-0 z-10 shrink-0 rounded-b-3xl border-t border-line bg-[#fbfdfc] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:static">
          <Button className="w-full text-base" disabled={!!blocker} busy={sell.isPending} onClick={() => { setErrors({}); sell.mutate(); }}>
            {paid === 0 && cart.length ? `Sell on credit · ${formatKobo(total)}` : `Charge ${formatKobo(total)}`}
          </Button>
        </div>
      </aside>

      {/* Mobile bar */}
      {cart.length > 0 && !cartInView && (
        <a href="#cart" className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-[#f40009] px-5 py-4 font-semibold text-white shadow-2xl shadow-black/30 lg:left-[20rem] xl:hidden">
          <span className="flex items-center gap-2"><Svg d={ICON.cart} className="size-5" /> {items} item{items === 1 ? "" : "s"}</span>
          <span>{formatKobo(total)} · Review</span>
        </a>
      )}

      {done && (
        <Modal title="Sale complete" onClose={() => setDone(null)}>
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ffe9ea] text-[#f40009] ring-8 ring-[#ffe9ea]/50"><Svg d={ICON.check} className="size-8" /></span>
            <p className="mt-4 text-3xl font-bold tracking-tight">{formatKobo(done.sale.total + (done.sale.deposit_total ?? 0))}</p>
            {(done.sale.deposit_total ?? 0) > 0 && <p className="mt-1 text-xs text-ink-soft">includes {formatKobo(done.sale.deposit_total ?? 0)} container deposit</p>}
            <p className="mt-1 text-sm text-ink-soft">{done.sale.number} · {done.sale.customer?.name ?? "Walk-in customer"}</p>
            {done.change > 0 && <p className="mx-auto mt-4 max-w-xs rounded-xl bg-[#ffe9ea] px-4 py-3 text-lg font-bold text-[#a50006]">Give change: {formatKobo(done.change)}</p>}
            {done.sale.balance_due > 0 && <p className="mx-auto mt-4 max-w-xs rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{formatKobo(done.sale.balance_due)} put on {done.sale.customer?.name}&apos;s account</p>}
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <a href={`/sales/receipt?id=${done.sale.id}&print=1`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold shadow-sm transition hover:border-[#ff3b3f]/40 hover:bg-[#fff5f5]"><Svg d={ICON.print} /> Print receipt</a>
            <Button onClick={() => { setDone(null); focusIfDesktop(searchRef.current); }}>New sale</Button>
          </div>
          <WhatsAppButton className="mt-2 w-full" phone={done.sale.customer?.phone} text={saleMessage(done.sale, s.store?.name ?? "", payTo).text} label={done.sale.balance_due > 0 ? "Send invoice on WhatsApp" : "Send receipt on WhatsApp"} />
          <p className="mt-3 text-center text-sm"><Link href={`/sales/view?id=${done.sale.id}`} className="font-semibold text-[#f40009] hover:underline">View sale details</Link></p>
        </Modal>
      )}
    </div>
  );
}
