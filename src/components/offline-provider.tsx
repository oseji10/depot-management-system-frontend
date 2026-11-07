"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../hooks/session";
import { openFieldDb, type FieldDb } from "../lib/offline/idb";
import { API_URL, authHeaders } from "../lib/auth";
import type { OfflineCustomer, QueueItem, QueueKind, Snapshot, SyncResult } from "../lib/offline/types";

const BATCH = 25;
const WARM_PAGES = ["/", "/pos", "/sales", "/expenses", "/customers"];
const SNAPSHOT_MAX_AGE_MS = 45_000; // refresh the download this often while online and nothing is waiting

export type SaleInput = {
  customer: OfflineCustomer | null;
  channel: "counter" | "phone" | "delivery";
  lines: { product_id: number; name: string; unit_id: number; qty: number; factor: number; price: number; list_price: number; mix?: { layoutId: number; group: string; label: string } }[];
  payments: { method: "cash" | "transfer" | "pos"; amount: number; pos_terminal_id?: number }[];
  empties?: { container_type_id: number; quantity: number }[];
  total: number; // goods plus container deposit
};

export type ExpenseInput = { category_id: number; category: string; amount: number; method: "cash" | "bank"; paid_to?: string; description?: string };

export type Offline = {
  ready: boolean;
  snapshot: Snapshot | null;
  online: boolean;
  syncing: boolean;
  authExpired: boolean;
  queue: QueueItem[];
  pending: number;
  rejected: number;
  lastSyncedAt: string | null;
  customers: OfflineCustomer[];
  stockOf: (productId: number) => number;
  sync: () => Promise<void>;
  refresh: () => Promise<boolean>;
  /** Download the customers of another route (an id), everyone ("all") or those with no route ("none"). Returns how many are new on this phone. */
  loadCustomers: (route: string) => Promise<number>;
  enqueueSale: (input: SaleInput) => Promise<QueueItem>;
  enqueueExpense: (input: ExpenseInput) => Promise<QueueItem>;
  addCustomer: (input: { name: string; phone: string; address: string; type: "retail" | "wholesale" }) => Promise<OfflineCustomer>;
  discard: (ref: string) => Promise<void>;
};

const OfflineContext = createContext<Offline | null>(null);

/** Null for managers; the salesperson's offline engine for anyone with a van. */
export const useOffline = () => useContext(OfflineContext);

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

class Unreachable extends Error {}

/** Plain fetch through the proxy. Never redirects to the login page: a signed-out phone must keep its queue. */
async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: T | null }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctl.signal,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    if (res.status >= 500 || res.status === 0) throw new Unreachable();
    return { status: res.status, data };
  } catch (e) {
    throw e instanceof Unreachable ? e : new Unreachable();
  } finally {
    clearTimeout(timer);
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const s = useSession();
  // Only salespeople work offline. Everyone else gets no engine, no service worker, no cached pages.
  if (!s.van) return <>{children}</>;
  return <Engine userId={s.user.id}>{children}</Engine>;
}

function Engine({ userId, children }: { userId: number; children: ReactNode }) {
  const queryClient = useQueryClient();
  const db = useRef<FieldDb | null>(null);
  const busy = useRef(false);
  const lastPing = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const snapRef = useRef<Snapshot | null>(null);

  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const setQ = useCallback((next: QueueItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const save = useCallback(async (item: QueueItem) => {
    await db.current?.put(item);
    setQ([...queueRef.current.filter((q) => q.ref !== item.ref), item].sort((a, b) => a.seq - b.seq));
  }, [setQ]);

  // ---- download ----
  const refresh = useCallback(async () => {
    try {
      const { status, data } = await call<Omit<Snapshot, "received_at">>("/field/bootstrap");
      setOnline(true);
      if (status === 401) { setAuthExpired(true); return false; }
      if (status !== 200 || !data) return false;
      setAuthExpired(false);
      // Customers loaded from other routes stay on the phone through a refresh.
      const carried = (snapRef.current?.customers ?? []).filter((c) => c.other_route && !data.customers.some((k) => k.id === c.id));
      const snap: Snapshot = { ...data, customers: [...data.customers, ...carried], received_at: new Date().toISOString() };
      snapRef.current = snap;
      setSnapshot(snap);
      await db.current?.setMeta("snapshot", snap);
      return true;
    } catch {
      setOnline(false);
      return false;
    }
  }, []);

  const loadCustomers = useCallback(async (route: string) => {
    const { status, data } = await call<{ customers: OfflineCustomer[] }>(`/field/customers?route_id=${encodeURIComponent(route)}`);
    if (status !== 200 || !data || !snapRef.current) throw new Error("Could not load customers. Check your signal and try again.");
    const have = new Set(snapRef.current.customers.map((c) => String(c.id)));
    const fresh = data.customers.filter((c) => !have.has(String(c.id))).map((c) => ({ ...c, other_route: true }));
    const snap: Snapshot = { ...snapRef.current, customers: [...snapRef.current.customers, ...fresh] };
    snapRef.current = snap;
    setSnapshot(snap);
    await db.current?.setMeta("snapshot", snap);
    return fresh.length;
  }, []);

  // ---- upload ----
  const sync = useCallback(async () => {
    if (busy.current || !db.current) return;

    const run = async () => {
      busy.current = true;
      setSyncing(true);
      try {
        for (;;) {
          const pending = queueRef.current.filter((q) => q.status === "pending").sort((a, b) => a.seq - b.seq);
          if (!pending.length) break;

          const batch = pending.slice(0, BATCH);
          let res;
          try {
            res = await call<{ results: SyncResult[]; server_time: string }>("/field/sync", {
              method: "POST",
              body: {
                snapshot_at: snapRef.current?.snapshot_at ?? null,
                pending: pending.length - batch.length,
                items: batch.map((b) => ({ type: b.kind, client_ref: b.ref, data: b.data })),
              },
            });
          } catch {
            setOnline(false);
            return;
          }

          setOnline(true);
          if (res.status === 401) { setAuthExpired(true); return; }
          if (res.status !== 200 || !res.data) {
            if (res.status === 403) { // this account cannot sync at all; stop and let the queue sit
              setAuthExpired(false);
            }
            return;
          }

          setAuthExpired(false);
          let stalled = false;

          for (const r of res.data.results) {
            const item = queueRef.current.find((q) => q.ref === r.client_ref);
            if (!item) continue;
            if (r.status === "retry") { stalled = true; continue; }
            if (r.status === "rejected") await save({ ...item, status: "rejected", error: r.error });
            else await save({ ...item, status: "synced", synced_at: res.data.server_time, number: r.number ?? item.number, server_id: r.id, error: undefined });
          }

          setLastSyncedAt(res.data.server_time);
          if (stalled) return;
        }

        // Nothing waiting any more: pick up the server's view (stock, prices, customers) and tidy up.
        if (!queueRef.current.some((q) => q.status === "pending")) {
          if (await refresh()) {
            const cutoff = Date.now() - 24 * 3600_000;
            for (const q of queueRef.current.filter((x) => x.status === "synced" && new Date(x.created_at).getTime() < cutoff)) {
              await db.current?.remove(q.ref);
            }
            setQ(queueRef.current.filter((q) => !(q.status === "synced" && new Date(q.created_at).getTime() < cutoff)));
          }
        }

        queryClient.invalidateQueries({ queryKey: ["field"] });
        queryClient.invalidateQueries({ queryKey: ["list", "/sales"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } finally {
        busy.current = false;
        setSyncing(false);
      }

      // Let the depot know the phone is alive and how much it is still holding.
      if (Date.now() - lastPing.current > 45_000) {
        lastPing.current = Date.now();
        call("/field/ping", { method: "POST", body: { pending: queueRef.current.filter((q) => q.status === "pending").length } }).then(() => setOnline(true)).catch(() => setOnline(false));
      }
    };

    // One tab syncs at a time, so the same sale is never sent twice at once.
    if (typeof navigator !== "undefined" && "locks" in navigator) {
      await navigator.locks.request("depot-sync", { ifAvailable: true }, async (lock) => { if (lock) await run(); });
    } else {
      await run();
    }
  }, [queryClient, refresh, save, setQ]);

  // ---- start up ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Ask the browser not to clear this phone's saved stock when it is short on space.
        try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
        db.current = await openFieldDb(userId);
        const saved = await db.current.getMeta<Snapshot>("snapshot");
        const items = (await db.current.all<QueueItem>()).sort((a, b) => a.seq - b.seq);
        if (!alive) return;
        if (saved) { snapRef.current = saved; setSnapshot(saved); }
        setQ(items);
      } catch {
        // IndexedDB blocked (private window): selling still works while online, but nothing can be queued.
      }
      if (alive) setReady(true);
      if (alive && navigator.onLine) { await sync(); if (alive && !queueRef.current.some((q) => q.status === "pending")) await refresh(); }
    })();
    return () => { alive = false; };
  }, [userId, sync, refresh, setQ]);

  // ---- service worker + cached pages ----
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async () => {
      const reg = await navigator.serviceWorker.ready;
      let warmed = false;
      try { warmed = sessionStorage.getItem("depot.warm") === "1"; } catch { /* ignore */ }
      if (!warmed && navigator.onLine) {
        reg.active?.postMessage({ type: "warm", urls: WARM_PAGES });
        try { sessionStorage.setItem("depot.warm", "1"); } catch { /* ignore */ }
      }
    }).catch(() => { /* the app still works online */ });
  }, []);

  // ---- when to sync ----
  useEffect(() => {
    const up = () => { setOnline(true); void sync(); };
    const down = () => setOnline(false);
    // Coming back to the app is when stock has most likely changed (the warehouse loaded the van), so re-download then too.
    const visible = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void sync().then(() => {
        const waiting = queueRef.current.some((q) => q.status === "pending");
        const age = snapRef.current ? Date.now() - new Date(snapRef.current.received_at).getTime() : Infinity;
        if (!waiting && age > 10_000) void refresh();
      });
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    document.addEventListener("visibilitychange", visible);
    setOnline(navigator.onLine);

    const timer = setInterval(() => {
      if (!navigator.onLine) return;
      const waiting = queueRef.current.some((q) => q.status === "pending");
      const stale = !snapRef.current || Date.now() - new Date(snapRef.current.received_at).getTime() > SNAPSHOT_MAX_AGE_MS;
      if (waiting) void sync();
      else if (stale) void refresh();
      else call("/field/ping", { method: "POST", body: { pending: 0 } }).then(() => setOnline(true)).catch(() => setOnline(false));
    }, 30_000);

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [sync, refresh]);

  // ---- queueing ----
  const nextSeq = useCallback(async () => {
    const n = ((await db.current?.getMeta<number>("seq")) ?? 0) + 1;
    await db.current?.setMeta("seq", n);
    return n;
  }, []);

  const enqueue = useCallback(async (kind: QueueKind, prefix: string, data: Record<string, unknown>, summary: QueueItem["summary"], number?: string) => {
    if (!db.current) throw new Error("This phone cannot save sales offline. Open the app in a normal (not private) browser window.");
    const seq = await nextSeq();
    const item: QueueItem = { ref: `${prefix}-${uid()}`, seq, kind, data, created_at: new Date().toISOString(), status: "pending", summary, number };
    await save(item);
    void sync();
    return item;
  }, [nextSeq, save, sync]);

  const enqueueSale = useCallback(async (i: SaleInput) => {
    const seq = ((await db.current?.getMeta<number>("seq")) ?? 0) + 1;
    const d = new Date();
    const provisional = `OFF-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${seq}`;
    const customerRef = i.customer && typeof i.customer.id === "string" ? i.customer.id : null;

    return enqueue("sale", "S", {
      ...(i.customer && customerRef === null ? { customer_id: i.customer.id } : {}),
      ...(customerRef ? { customer_ref: customerRef } : {}),
      channel: i.channel, sold_at: d.toISOString(),
      lines: i.lines.map((l) => ({ product_id: l.product_id, unit_id: l.unit_id, quantity: l.qty, ...(l.price !== l.list_price ? { unit_price: l.price } : {}), ...(l.mix ? { mix_layout_id: l.mix.layoutId, mix_group: l.mix.group } : {}) })),
      payments: i.payments.filter((p) => p.amount > 0),
      ...(i.empties?.length ? { empties_returned: i.empties } : {}),
    }, {
      title: `${provisional}${i.customer ? ` · ${i.customer.name}` : ""}`, total: i.total, customer: i.customer?.name ?? null,
      paid: i.payments.reduce((n, p) => n + p.amount, 0),
      lines: i.lines.map((l) => ({ product_id: l.product_id, name: l.name, qty: l.qty, base: l.qty * l.factor })),
    }, provisional);
  }, [enqueue]);

  const enqueueExpense = useCallback((i: ExpenseInput) => enqueue("expense", "E", {
    category_id: i.category_id, amount: i.amount, method: i.method, paid_to: i.paid_to || null, description: i.description || null,
    expense_date: new Date().toLocaleDateString("en-CA"),
  }, { title: `${i.category}${i.paid_to ? ` · ${i.paid_to}` : ""}`, total: i.amount }), [enqueue]);

  const addCustomer = useCallback(async (i: { name: string; phone: string; address: string; type: "retail" | "wholesale" }) => {
    const item = await enqueue("customer", "C", { name: i.name, phone: i.phone, address: i.address, type: i.type }, { title: i.name, total: 0 });
    return { id: item.ref, name: i.name, phone: i.phone, address: i.address, type: i.type, empties_mode: i.type === "wholesale" ? "balance" : "deposit", credit_limit: 0, owing: 0, pending: true } satisfies OfflineCustomer;
  }, [enqueue]);

  const discard = useCallback(async (ref: string) => {
    await db.current?.remove(ref);
    setQ(queueRef.current.filter((q) => q.ref !== ref));
  }, [setQ]);

  // ---- what the till shows ----
  /** Stock on the van = the last download, minus everything sold since that the download does not know about yet. */
  const stockOf = useCallback((productId: number) => {
    const base = snapshot?.catalogue.products.find((p) => p.id === productId)?.stock ?? 0;
    let used = 0;
    for (const q of queue) {
      if (q.kind !== "sale") continue;
      const unseen = q.status !== "synced" || (q.synced_at && snapshot && new Date(q.synced_at) > new Date(snapshot.snapshot_at));
      if (unseen) used += q.summary.lines?.filter((l) => l.product_id === productId).reduce((n, l) => n + l.base, 0) ?? 0;
    }
    return Math.max(base - used, 0);
  }, [snapshot, queue]);

  const customers = useMemo(() => {
    const known = snapshot?.customers ?? [];
    const made: OfflineCustomer[] = queue
      .filter((q) => q.kind === "customer" && !(q.status === "synced" && q.server_id && known.some((k) => k.id === q.server_id)))
      .map((q) => ({
        id: q.status === "synced" && q.server_id ? q.server_id : q.ref, name: String(q.data.name), phone: (q.data.phone as string | null) ?? null,
        type: (q.data.type as "retail" | "wholesale") ?? "retail", credit_limit: 0, owing: 0, pending: q.status !== "synced",
      }));
    return [...made, ...known];
  }, [snapshot, queue]);

  const value: Offline = useMemo(() => ({
    ready, snapshot, online, syncing, authExpired, queue, lastSyncedAt, customers, stockOf, sync, refresh, loadCustomers,
    pending: queue.filter((q) => q.status === "pending").length,
    rejected: queue.filter((q) => q.status === "rejected").length,
    enqueueSale, enqueueExpense, addCustomer, discard,
  }), [ready, snapshot, online, syncing, authExpired, queue, lastSyncedAt, customers, stockOf, sync, refresh, loadCustomers, enqueueSale, enqueueExpense, addCustomer, discard]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
