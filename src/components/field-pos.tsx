"use client";

import { useInView } from "../hooks/in-view";
import { TerminalSelect, terminalOf } from "./terminal-select";
import { ReceiptShareButton } from "./receipt-share-button";
import { TransferTarget, transferPayload, transferReady, type TransferValue } from "./transfer-target";
import { EmptiesPanel } from "./empties-panel";
import { emptiesPayload, emptiesPlan } from "../lib/empties";
import { ProductThumb } from "./product-image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../hooks/session";
import { formatKobo, koboToInput, nairaToKobo } from "../lib/format";
import { CHANNEL_LABEL, CREDIT_LABEL, METHOD_PAY_LABEL } from "../lib/status";
import type { OfflineCustomer } from "../lib/offline/types";
import type { PosProduct, PosUnit, Sale, MixLayoutChoice } from "../lib/types";
import { useOffline } from "./offline-provider";
import { InstallHint } from "./install-hint";
import { Receipt } from "./receipt";
import { focusIfDesktop } from "../lib/focus";
import { MixBuilder, type MixPick } from "./mix-builder";
import { Button, ErrorNote, FilterSelect, ICON, Modal, Svg, filterClass, inputClass } from "./ui";

type CartLine = { key: string; product: PosProduct; unit: PosUnit; qty: number; price: number; mix?: { layoutId: number; group: string; label: string } };
type Method = keyof typeof METHOD_PAY_LABEL | "credit";
type PayRow = { id: number; method: Method; amount: string | null; terminal?: number; transfer?: TransferValue };
const LABEL: Record<Method, string> = { ...METHOD_PAY_LABEL, credit: CREDIT_LABEL };

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function stockText(p: PosProduct, stock: number) {
  const base = p.units.find((u) => u.factor === 1)?.name ?? "units";
  const big = p.units[p.units.length - 1];
  const crates = big && big.factor > 1 && stock >= big.factor ? ` · ${Math.floor(stock / big.factor)} ${big.name}` : "";
  return `${stock.toLocaleString("en-NG")} ${base}${crates}`;
}

/**
 * The van salesman's till. It sells from what the phone already holds (stock on the van, prices, customers) and saves each
 * sale on the phone first. Sending to the depot happens in the background, now or whenever there is signal.
 */
export function FieldPos() {
  const s = useSession();
  const o = useOffline()!;
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const cartInView = useInView("cart");
  const [mixing, setMixing] = useState(false);
  const [customer, setCustomer] = useState<OfflineCustomer | null>(null);
  const [channel, setChannel] = useState<keyof typeof CHANNEL_LABEL>("delivery");
  const [rows, setRows] = useState<PayRow[]>([]);
  const [returned, setReturned] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ sale: Sale; change: number; queued: boolean } | null>(null);
  const [receipt, setReceipt] = useState(false);

  const snap = o.snapshot;
  const catalogue = snap?.catalogue;

  // Opening the till always fetches the latest load first, so stock the warehouse issued a moment ago is there.
  const refreshOnOpen = useRef(false);
  useEffect(() => {
    if (!o.ready || refreshOnOpen.current) return;
    refreshOnOpen.current = true;
    if (o.online && !o.queue.some((q) => q.status === "pending")) void o.refresh();
  }, [o]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshStock = async () => { setRefreshing(true); await o.refresh(); setRefreshing(false); };
  const canDiscount = !!snap?.can_discount;

  // ---- money ----
  const terminals = catalogue?.terminals ?? [];
  const accounts = catalogue?.transfer_accounts ?? [];
  const goods = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const mode = customer?.empties_mode ?? "deposit";
  const plan = useMemo(() => emptiesPlan(cart, catalogue?.containers ?? [], mode, returned), [cart, catalogue, mode, returned]);
  const total = goods + plan.deposit; // goods plus container deposit
  const listTotal = cart.reduce((n, l) => n + l.unit.price * l.qty, 0) + plan.deposit;
  const resolved = useMemo(() => {
    const fixed = rows.reduce((n, r) => n + (r.amount === null ? 0 : nairaToKobo(r.amount)), 0);
    return rows.map((r) => ({ ...r, kobo: r.amount === null ? Math.max(total - fixed, 0) : nairaToKobo(r.amount) }));
  }, [rows, total]);
  const paid = resolved.filter((r) => r.method !== "credit").reduce((n, r) => n + r.kobo, 0);   // money actually received now
  const onCredit = resolved.filter((r) => r.method === "credit").reduce((n, r) => n + r.kobo, 0); // put on the customer's account
  const remaining = Math.max(total - paid - onCredit, 0);
  const change = Math.max(paid + onCredit - total, 0);
  const cashRow = resolved.filter((r) => r.method === "cash" && r.kobo >= change).sort((a, b) => b.kobo - a.kobo)[0];

  // ---- stock on the van, as the phone knows it ----
  const stock = (p: PosProduct) => o.stockOf(p.id);
  const need = new Map<number, number>();
  cart.forEach((l) => need.set(l.product.id, (need.get(l.product.id) ?? 0) + l.qty * l.unit.factor));
  const short = (l: CartLine) => (need.get(l.product.id) ?? 0) > stock(l.product);

  // ---- credit the customer has left, counting what this phone has already put on their account ----
  const creditLeft = useMemo(() => {
    if (!customer) return 0;
    const extra = o.queue.reduce((n, q) => {
      if (q.kind !== "sale") return n;
      const mine = q.data.customer_id === customer.id || q.data.customer_ref === customer.id;
      const unseen = q.status !== "synced" || (q.synced_at && snap && new Date(q.synced_at) > new Date(snap.snapshot_at));
      return mine && unseen ? n + Math.max(q.summary.total - (q.summary.paid ?? 0), 0) : n;
    }, 0);
    return Math.max(customer.credit_limit - customer.owing - extra, 0);
  }, [customer, o.queue, snap]);

  const blocker =
    !cart.length ? "Add products to start a sale"
    : cart.some(short) ? "Some items are more than what is on your van"
    : onCredit > 0 && !customer ? "Choose a customer to sell on credit"
    : onCredit > 0 && customer && onCredit > creditLeft ? (creditLeft > 0 ? `${customer.name} has ${formatKobo(creditLeft)} credit left` : `${customer.name} has no credit. Ask the office to give them a credit limit.`)
    : remaining > 0 ? "Choose how the rest is paid, or put it on credit"
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


  function addPayment(method: Method) {
    if (remaining === 0 && rows.length) return;
    setRows((r) => [...r.map((x) => (x.amount === null ? { ...x, amount: koboToInput(resolved.find((q) => q.id === x.id)?.kobo ?? 0) } : x)), { id: Date.now(), method, amount: null }]);
  }

  function reset() {
    setCart([]); setRows([]); setReturned({}); setCustomer(null); setChannel("delivery"); setError(null);
    focusIfDesktop(searchRef.current);
  }

  async function charge() {
    setSaving(true);
    setError(null);
    try {
      let giveBack = change;
      const payments = resolved.filter((r) => r.kobo > 0 && r.method !== "credit").map((r) => {
        const cut = giveBack > 0 && r.id === cashRow?.id ? giveBack : 0;
        giveBack -= cut;
        return {
          method: r.method as "cash" | "transfer" | "pos", amount: r.kobo - cut,
          ...(r.method === "pos" && terminalOf(r.terminal, terminals) ? { pos_terminal_id: terminalOf(r.terminal, terminals) } : {}),
          ...(r.method === "transfer" ? transferPayload({ ...r.transfer, to: r.transfer?.to ?? (terminals.length ? undefined : "account") }, terminals, r.terminal) : {}),
        };
      }).filter((p) => p.amount > 0);

      const item = await o.enqueueSale({
        customer, channel, total, payments, empties: emptiesPayload(plan.rows),
        lines: cart.map((l) => ({ product_id: l.product.id, name: l.product.name, unit_id: l.unit.unit_id, qty: l.qty, factor: l.unit.factor, price: l.price, list_price: l.unit.price, ...(l.mix ? { mix: l.mix } : {}) })),
      });

      const amountPaid = payments.reduce((n, p) => n + p.amount, 0);
      const sale: Sale = {
        id: 0, number: item.number ?? item.ref, channel, status: "completed", payment_status: amountPaid >= total ? "paid" : amountPaid > 0 ? "partial" : "unpaid",
        sold_at: item.created_at, subtotal: listTotal, discount_total: listTotal - total, total: goods, deposit_total: plan.deposit, amount_paid: amountPaid, balance_due: total - amountPaid,
        note: null, void_reason: null, voided_at: null,
        customer: customer ? { id: 0, name: customer.name, phone: customer.phone } : null,
        creator: { id: s.user.id, name: s.user.name },
        lines: cart.map((l, i) => ({ id: i, product_id: l.product.id, unit_id: l.unit.unit_id, factor: l.unit.factor, quantity: l.qty, list_price: l.unit.price, unit_price: l.price, line_total: l.price * l.qty, mix_label: l.mix?.label ?? null, mix_group: l.mix?.group ?? null, product: { id: l.product.id, name: l.product.name, sku: l.product.sku, size_label: l.product.size_label }, unit: { id: l.unit.unit_id, name: l.unit.name } })),
        payments: payments.map((p, i) => ({ id: i, method: p.method, amount: p.amount, reference: null, paid_at: item.created_at, voided_at: null })),
      };
      setDone({ sale, change, queued: true });
      setReceipt(false);
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (catalogue?.products ?? []).filter((p) => (!category || p.category_id === category) && (!term || `${p.name} ${p.sku} ${p.size_label ?? ""} ${p.brand ?? ""}`.toLowerCase().includes(term)));
  }, [catalogue, search, category]);
  const categories = useMemo(() => {
    const used = new Set(catalogue?.products.map((p) => p.category_id));
    return (catalogue?.categories ?? []).filter((c) => used.has(c.id));
  }, [catalogue]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !search.trim()) return;
    for (const p of catalogue?.products ?? []) {
      const u = p.units.find((x) => x.barcode && x.barcode === search.trim());
      if (u) return add(p, u);
    }
    if (products.length === 1 && products[0].units.length === 1) add(products[0], products[0].units[0]);
  }

  // The till stays usable if the phone has never downloaded anything only when it can reach the depot right now.
  useEffect(() => { if (o.ready && !snap && o.online) void o.refresh(); }, [o, snap]);

  const items = cart.reduce((n, l) => n + l.qty, 0);
  const noLoad = !!snap && !snap.trip;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
      {mixing && <MixBuilder layouts={catalogue?.mix_layouts ?? []} products={(catalogue?.products ?? []).map((p) => ({ ...p, stock: stock(p) }))} used={need} onAdd={addMix} onClose={() => setMixing(false)} />}
      <section aria-label="Products" className="min-w-0 pb-24 lg:pb-0">
        {!o.online && (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset">
            <span className="size-2 rounded-full bg-amber-500" /> No signal. Keep selling; every sale is saved on this phone and sent later.
          </p>
        )}

        <div className="sticky top-[3.25rem] z-20 -mx-4 mb-4 space-y-3 bg-paper/90 px-4 pt-1 pb-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-5 lg:px-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-60 flex-1">
              <Svg d={ICON.search} className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" />
              <input
                ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey}
                placeholder="Search products" aria-label="Search products" className={`${filterClass} min-h-12 w-full pr-10 pl-10 text-[15px]`}
              />
            </div>
            <span className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1 text-[13px] font-medium whitespace-nowrap text-ink-soft">{s.van?.name}</span>
            <button type="button" onClick={refreshStock} disabled={!o.online || refreshing} title={snap ? `Stock last downloaded ${new Date(snap.received_at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : undefined}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[13px] font-medium whitespace-nowrap text-[#f40009] hover:border-[#ff3b3f]/40 disabled:opacity-50">
              <Svg d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Updating…" : snap ? `Stock saved ${new Date(snap.received_at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : "Refresh stock"}
            </button>
          </div>
          {(catalogue?.mix_layouts ?? []).length > 0 && (
            <div>
              <Button type="button" variant="secondary" onClick={() => setMixing(true)}>Mixed crate</Button>
            </div>
          )}
          <div className="-mx-1 flex gap-2 relative overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Categories">
            {[{ id: 0, name: "All" }, ...categories].map((c) => (
              <button
                key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                className={`min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition ${category === c.id ? "border-[#f40009] bg-[#f40009] text-white shadow-sm" : "border-line bg-white text-ink-soft hover:border-[#ff3b3f]/40 hover:text-ink"}`}
              >{c.name}</button>
            ))}
          </div>
        </div>

        <InstallHint />
        {!!catalogue?.unpriced?.length && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {catalogue.unpriced.length} product{catalogue.unpriced.length > 1 ? "s" : ""} on your van can&apos;t be sold yet because {catalogue.unpriced.length > 1 ? "they have" : "it has"} no price: {catalogue.unpriced.slice(0, 4).map((u) => u.name).join(", ")}{catalogue.unpriced.length > 4 ? "…" : ""}. Ask the office to set the price.
            {catalogue.unpriced.slice(0, 3).map((u) => u.why && <span key={u.id} className="block">{u.name}: {u.why}</span>)}
          </p>
        )}
        {!o.ready ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-line" />)}</div>
        ) : !snap ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface py-14 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Svg d={ICON.alert} className="size-7" /></span>
            <p className="mt-4 font-semibold">{o.online ? "Getting your load…" : "Connect once to download your load"}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
              {o.authExpired ? "Your sign-in has expired. Sign in again." : o.online ? "This takes a few seconds." : "This phone has not downloaded your products and prices yet. Get a signal once, then you can sell with none."}
            </p>
            {o.online && !o.authExpired && <Button className="mt-4" variant="secondary" onClick={() => o.refresh()}>Try again</Button>}
          </div>
        ) : noLoad ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]"><Svg d={ICON.box} className="size-7" /></span>
            <p className="mt-4 font-semibold">No stock has been issued to you</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Ask the warehouse to load your van. Once they do, your products appear here.</p>
            <Button className="mt-4" variant="secondary" onClick={() => o.refresh()}>Check again</Button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center"><p className="font-semibold">Nothing matches your search</p></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => {
              const have = stock(p);
              const inCart = cart.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.qty * l.unit.factor, 0);
              const left = have - inCart;
              return (
                <div key={p.id} className={`flex flex-col rounded-2xl border bg-surface p-4 shadow-sm transition ${have <= 0 ? "border-line opacity-70" : "border-line hover:border-[#ff3b3f]/40 hover:shadow-md"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <ProductThumb url={p.image_url} name={p.name} className="size-12 rounded-xl" fallbackClass="bg-[#ffe9ea] text-[#f40009] ring-[#ff3b3f]/20" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 leading-snug font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{[p.size_label, p.sku].filter(Boolean).join(" · ")}</p>
                    </div>
                    {inCart > 0 && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f40009] text-xs font-bold text-white" title="In this sale">{cart.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.qty, 0)}</span>}
                  </div>
                  <p className={`mt-2 text-xs font-medium ${have <= 0 ? "text-[#c23a3a]" : "text-ink-soft"}`}>{have <= 0 ? "None left on the van" : `${stockText(p, have)} on the van`}</p>
                  <div className="mt-3 flex flex-wrap gap-2 pt-1">
                    {p.units.map((u) => (
                      <button
                        key={u.product_unit_id} type="button" onClick={() => add(p, u)} disabled={left < u.factor}
                        className="flex min-h-11 flex-1 basis-24 flex-col items-start rounded-xl border border-line bg-[#fff5f5] px-3 py-1.5 text-left transition hover:border-[#ff3b3f] hover:bg-[#ffe9ea] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
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

      <aside id="cart" aria-label="Current sale" className="mb-20 flex flex-col rounded-3xl border border-line bg-surface shadow-lg shadow-black/5 lg:sticky lg:top-3 lg:mb-0 lg:h-[calc(100dvh-1.5rem)] lg:overflow-hidden">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Current sale {items > 0 && <span className="ml-1 text-sm font-medium text-ink-soft">· {items} item{items === 1 ? "" : "s"}</span>}</h2>
            {cart.length > 0 && <button type="button" onClick={reset} className="text-sm font-semibold text-[#c23a3a] hover:underline">Clear</button>}
          </div>
          <FieldCustomerPicker value={customer} onChange={(c) => { setCustomer(c); setError(null); }} />
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="channel" className="text-ink-soft">Order type</label>
            <FilterSelect id="channel" label="Order type" value={channel} onChange={(v) => setChannel(v as keyof typeof CHANNEL_LABEL)}>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </FilterSelect>
          </div>
        </div>

        <div className="min-h-40 flex-1 p-2 lg:min-h-24 lg:overflow-y-auto">
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
                        <button type="button" disabled={!canDiscount} onClick={() => setEditing(l.key)} className={`text-sm font-bold ${canDiscount ? "hover:text-[#f40009] hover:underline" : "cursor-default"}`}>
                          {formatKobo(l.price * l.qty)}
                        </button>
                      )}
                      <p className="text-[11px] text-ink-soft">{l.price < l.unit.price && <span className="mr-1 line-through">{formatKobo(l.unit.price)}</span>}{formatKobo(l.price)} each</p>
                    </div>
                  </div>
                  {short(l) && <p className="mt-2 text-xs font-semibold text-[#c23a3a]">Only {stockText(l.product, stock(l.product))} on your van</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-line bg-[#fbfdfc] p-4 lg:max-h-[62%] lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain">
          <EmptiesPanel rows={plan.rows} mode={mode} onChange={(id, q) => setReturned((r) => ({ ...r, [id]: Math.max(0, q) }))} />
          {plan.deposit > 0 && <div className="flex justify-between text-sm text-ink-soft"><span>Container deposit</span><span>{formatKobo(plan.deposit)}</span></div>}
          {listTotal > total && <div className="flex justify-between text-sm text-ink-soft"><span>Discount</span><span>−{formatKobo(listTotal - total)}</span></div>}
          <div className="flex items-baseline justify-between"><span className="text-sm font-medium text-ink-soft">Total</span><span className="text-3xl font-bold tracking-tight">{formatKobo(total)}</span></div>

          {cart.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Payment</p>
              {resolved.map((r) => (
                <div key={r.id}>
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm font-medium">{LABEL[r.method]}</span>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-soft" aria-hidden="true">₦</span>
                    <input
                      aria-label={`${LABEL[r.method]} amount`} inputMode="decimal" value={rows.find((x) => x.id === r.id)?.amount ?? koboToInput(r.kobo)}
                      onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, amount: e.target.value.replace(/[^0-9.,]/g, "") } : x)))}
                      className={`${inputClass} min-h-10 pl-7 text-right font-semibold`}
                    />
                  </div>
                  <button type="button" aria-label={`Remove ${LABEL[r.method]} payment`} onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))} className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-red-50 hover:text-[#c23a3a]"><Svg d={ICON.x} /></button>
                </div>
                {r.method === "transfer" && (
                  <TransferTarget accounts={accounts} terminals={terminals} value={rows.find((x) => x.id === r.id)?.transfer ?? {}} terminal={rows.find((x) => x.id === r.id)?.terminal}
                    onChange={(v) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, transfer: v } : x)))}
                    onTerminal={(id) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, terminal: id } : x)))} />
                )}
                {r.method === "credit" && <p className="mt-1 pl-[6.5rem] text-xs text-ink-soft">Nothing is paid now. It goes on {customer ? `${customer.name}'s` : "the customer's"} account.</p>}
                {r.method === "pos" && <TerminalSelect terminals={terminals} value={terminalOf(rows.find((x) => x.id === r.id)?.terminal, terminals)} onChange={(id) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, terminal: id } : x)))} />}
              </div>
              ))}
              {(remaining > 0 || rows.length === 0) && (
                <>
                <div className="grid grid-cols-2 gap-2">
                  {(["cash", "transfer", "pos", "credit"] as Method[]).map((m) => (
                    <button key={m} type="button" onClick={() => addPayment(m)} disabled={m === "credit" && !customer}
                      title={m === "credit" && !customer ? "Choose a customer first" : undefined}
                      className="min-h-11 rounded-xl border border-line bg-white px-2 text-[13px] font-semibold shadow-sm transition hover:border-[#ff3b3f] hover:bg-[#ffe9ea] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line disabled:hover:bg-white">
                      {rows.length ? "+ " : ""}{LABEL[m]}
                    </button>
                  ))}
                </div>
                {!customer && <p className="text-xs text-ink-soft">To sell on credit, choose the customer first.</p>}
                </>
              )}
              {change > 0 && <p className="flex justify-between rounded-xl bg-[#ffe9ea] px-3 py-2.5 text-sm font-bold text-[#a50006]"><span>Change to give</span><span>{formatKobo(change)}</span></p>}
              {onCredit > 0 && <p className="flex justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800"><span>On credit</span><span>{formatKobo(onCredit)}</span></p>}
              {remaining > 0 && <p className="flex justify-between rounded-xl border border-dashed border-amber-300 px-3 py-2.5 text-sm font-semibold text-amber-800"><span>Still to allocate</span><span>{formatKobo(remaining)}</span></p>}
              {remaining > 0 && rows.length === 0 && <p className="text-xs text-ink-soft">Choose how it is paid. Split it across methods if the customer is paying some of it in cash and the rest by transfer.</p>}
            </div>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
          {blocker && cart.length > 0 && <p className="text-xs font-medium text-amber-700">{blocker}</p>}

        </div>

        {/* The charge bar never scrolls away: it sticks to the bottom of the screen on phones and tablets, and to the bottom of the panel on wide screens. */}
        <div className="sticky bottom-0 z-10 shrink-0 rounded-b-3xl border-t border-line bg-[#fbfdfc] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static">
          <Button className="w-full text-base" disabled={!!blocker || !snap} busy={saving} onClick={charge}>
            {paid === 0 && onCredit > 0 ? `Sell on credit · ${formatKobo(total)}` : `Charge ${formatKobo(total)}`}
          </Button>
        </div>
      </aside>

      {cart.length > 0 && !cartInView && (
        <a href="#cart" className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-[#f40009] px-5 py-4 font-semibold text-white shadow-2xl shadow-black/30 lg:hidden">
          <span className="flex items-center gap-2"><Svg d={ICON.cart} className="size-5" /> {items} item{items === 1 ? "" : "s"}</span>
          <span>{formatKobo(total)} · Review</span>
        </a>
      )}

      {done && (
        <Modal title={receipt ? "Receipt" : "Sale saved"} onClose={() => setDone(null)}>
          {receipt ? (
            <>
              <Receipt sale={done.sale} storeName={snap?.store?.name ?? ""} change={done.change} />
              <div className="mt-4"><Button className="w-full" onClick={() => setReceipt(false)}>Back</Button></div>
            </>
          ) : (
            <>
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ffe9ea] text-[#f40009] ring-8 ring-[#ffe9ea]/50"><Svg d={ICON.check} className="size-8" /></span>
                <p className="mt-4 text-3xl font-bold tracking-tight">{formatKobo(done.sale.total + (done.sale.deposit_total ?? 0))}</p>
                <p className="mt-1 text-sm text-ink-soft">{done.sale.number} · {done.sale.customer?.name ?? "Walk-in customer"}</p>
                {done.change > 0 && <p className="mx-auto mt-4 max-w-xs rounded-xl bg-[#ffe9ea] px-4 py-3 text-lg font-bold text-[#a50006]">Give change: {formatKobo(done.change)}</p>}
                {done.sale.balance_due > 0 && <p className="mx-auto mt-4 max-w-xs rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{formatKobo(done.sale.balance_due)} put on {done.sale.customer?.name}&apos;s account</p>}
                <p className="mx-auto mt-4 max-w-xs text-xs text-ink-soft">{o.online ? "Saved on this phone and being sent to the depot." : "Saved on this phone. It will be sent when you have a signal."}</p>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={() => setReceipt(true)}>Show receipt</Button>
                <Button onClick={() => { setDone(null); focusIfDesktop(searchRef.current); }}>New sale</Button>
              </div>
              <ReceiptShareButton className="mt-2 w-full" sale={done.sale} store={{ ...s.store, name: snap?.store?.name ?? s.store?.name }} />
              <p className="mt-3 text-center text-sm"><Link href="/sales" className="font-semibold text-[#f40009] hover:underline">View my sales</Link></p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Customers come from the phone's own copy, so this works with no signal. New customers are saved on the phone and sent later. */
function FieldCustomerPicker({ value, onChange }: { value: OfflineCustomer | null; onChange: (c: OfflineCustomer | null) => void }) {
  const o = useOffline()!;
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "", type: "retail" as "retail" | "wholesale" });
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const routes = o.snapshot?.routes ?? [];
  const others = o.snapshot?.other_routes ?? [];

  async function loadMore(route: string, label: string) {
    setLoadingRoute(route); setLoaded(null);
    try {
      const n = await o.loadCustomers(route);
      setLoaded(n ? `Loaded ${n} customer${n === 1 ? "" : "s"} from ${label}.` : `Everyone on ${label} is already on this phone.`);
    } catch (e) { setLoaded((e as Error).message); } finally { setLoadingRoute(null); }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return o.customers.filter((c) => !t || c.name.toLowerCase().includes(t) || (c.phone ?? "").includes(t)).slice(0, 30);
  }, [o.customers, term]);

  const pick = (c: OfflineCustomer | null) => { onChange(c); setOpen(false); setTerm(""); };

  async function create() {
    if (!form.name.trim()) return setErr("Enter the customer's name.");
    if (!form.phone.trim()) return setErr("Enter the customer's phone number.");
    if (!form.address.trim()) return setErr("Enter the customer's address.");
    if (o.customers.some((c) => c.phone === form.phone.trim())) return setErr("A customer with this phone number already exists. Search for them instead.");
    const c = await o.addCustomer({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), type: form.type });
    setAdding(false); setForm({ name: "", phone: "", address: "", type: "retail" }); setErr(null);
    pick(c);
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-haspopup="listbox" aria-expanded={open} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-white px-3 text-left text-sm shadow-sm transition hover:border-[#ff3b3f]/40">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${value ? "bg-[#ffe9ea] text-[#f40009]" : "bg-paper text-ink-soft"}`}>{value ? value.name.charAt(0).toUpperCase() : <Svg d={ICON.people} className="size-4" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{value?.name ?? "Select or add customer"}</span>
          <span className="block truncate text-xs text-ink-soft">{value ? `${value.phone ?? "No phone"} · ${value.credit_limit ? "on credit" : "cash only"}${value.pending ? " · not sent yet" : ""}` : "Or leave empty for a walk-in who pays now"}</span>
        </span>
        <Svg d={ICON.chevron} className="size-4 shrink-0 text-ink-soft" />
      </button>

      {open && (
        <div className="animate-rise absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          {adding ? (
            <div className="space-y-2.5 p-3">
              <p className="text-sm font-semibold">New customer</p>
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" aria-label="Customer name" className={`${inputClass} min-h-10`} />
              <input value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" aria-label="Customer phone" required className={`${inputClass} min-h-10`} />
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" aria-label="Customer address" required className={`${inputClass} min-h-10`} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "retail" | "wholesale" })} aria-label="Customer type" className={`${filterClass} min-h-10 w-full`}>
                <option value="retail">Retail</option><option value="wholesale">Wholesale</option>
              </select>
              {err && <p className="text-xs font-medium text-[#c23a3a]">{err}</p>}
              <p className="text-xs text-ink-soft">New customers start as cash-only. A manager can give credit later.</p>
              <div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={() => { setAdding(false); setErr(null); }}>Back</Button><Button size="sm" onClick={create}>Save</Button></div>
            </div>
          ) : (
            <>
              <div className="border-b border-line p-2.5"><input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name or phone" aria-label="Search customers" className={`${inputClass} min-h-10`} /></div>
              <ul role="listbox" className="max-h-64 overflow-y-auto p-1.5">
                <li><button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#fff5f5]"><span className="grid size-8 place-items-center rounded-full bg-paper text-ink-soft"><Svg d={ICON.people} className="size-4" /></span><span><span className="block font-semibold">Walk-in customer</span><span className="text-xs text-ink-soft">Pays in full now</span></span></button></li>
                {list.map((c) => (
                  <li key={String(c.id)}>
                    <button type="button" onClick={() => pick(c)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#fff5f5]">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffe9ea] text-xs font-bold text-[#f40009]">{c.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.name}</span><span className="block truncate text-xs text-ink-soft">{c.phone ?? "No phone"}{c.other_route ? " · other route" : ""}</span></span>
                      {c.owing > 0 && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 ring-inset">owes {formatKobo(c.owing)}</span>}
                    </button>
                  </li>
                ))}
                {list.length === 0 && term && <li className="px-3 py-3 text-sm text-ink-soft">No customer matches.</li>}
              </ul>
              {routes.length > 0 && (
                <div className="border-t border-line p-2.5 text-xs">
                  <p className="text-ink-soft">Showing customers on {routes.map((r) => r.name).join(", ")}.</p>
                  {!more ? (
                    <button type="button" onClick={() => setMore(true)} className="mt-1 font-semibold text-[#f40009] hover:underline">Load customers from other routes</button>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {others.map((r) => (
                        <button key={r.id} type="button" disabled={!o.online || !!loadingRoute} onClick={() => void loadMore(String(r.id), r.name)}
                          className="min-h-8 rounded-full border border-line bg-white px-2.5 font-medium disabled:opacity-50">{loadingRoute === String(r.id) ? "Loading…" : `${r.name} (${r.customers})`}</button>
                      ))}
                      <button type="button" disabled={!o.online || !!loadingRoute} onClick={() => void loadMore("none", "customers with no route")} className="min-h-8 rounded-full border border-line bg-white px-2.5 font-medium disabled:opacity-50">No route</button>
                      <button type="button" disabled={!o.online || !!loadingRoute} onClick={() => void loadMore("all", "everyone")} className="min-h-8 rounded-full border border-[#f40009] bg-[#ffe9ea] px-2.5 font-semibold text-[#f40009] disabled:opacity-50">{loadingRoute === "all" ? "Loading…" : "Everyone"}</button>
                      {!o.online && <p className="w-full text-amber-700">You need a signal to load more customers.</p>}
                    </div>
                  )}
                  {loaded && <p className="mt-1.5 font-medium text-ink">{loaded}</p>}
                </div>
              )}
              <div className="border-t border-line p-1.5"><button type="button" onClick={() => { setAdding(true); setForm((f) => ({ ...f, name: term })); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#f40009] transition hover:bg-[#ffe9ea]"><Svg d={ICON.plus} /> Add a new customer</button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
