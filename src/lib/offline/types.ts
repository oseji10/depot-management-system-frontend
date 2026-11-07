import type { PosCatalogue } from "../types";

/** Everything the phone downloads once it has signal (GET /field/bootstrap). */
export type Snapshot = {
  snapshot_at: string; // server time when it was taken
  received_at: string; // phone time when it arrived
  store: { name: string } | null;
  user: { id: number; name: string };
  van: { id: number; name: string };
  trip: { id: number; number: string; opened_at: string } | null;
  catalogue: PosCatalogue;
  customers: OfflineCustomer[];
  routes?: { id: number; name: string }[]; // routes this salesperson covers
  other_routes?: { id: number; name: string; customers: number }[]; // routes they can load on request
  expense_categories: { id: number; name: string }[];
  can_discount: boolean;
};

export type OfflineCustomer = {
  id: number | string; // string = made on this phone, not on the server yet
  name: string;
  phone: string | null;
  address?: string | null;
  type: "retail" | "wholesale";
  empties_mode?: "deposit" | "balance" | "none";
  credit_limit: number;
  owing: number;
  pending?: boolean;
  other_route?: boolean; // loaded from a route that is not theirs
};

export type QueueKind = "sale" | "expense" | "customer";

/** One thing done offline, waiting to reach the server. `ref` is also the server-side idempotency key. */
export type QueueItem = {
  ref: string;
  seq: number;
  kind: QueueKind;
  data: Record<string, unknown>;
  created_at: string; // phone time
  status: "pending" | "rejected" | "synced";
  error?: string;
  synced_at?: string; // SERVER time, so it can be compared with snapshot_at
  number?: string; // the real number once the server has it
  server_id?: number; // the real id once the server has it
  summary: {
    title: string; // "OFF-0412-3 · Mama Tolu"
    total: number; // kobo
    lines?: { product_id: number; name: string; qty: number; base: number }[]; // base = base units taken off the van
    paid?: number;
    customer?: string | null;
  };
};

export type SyncResult = {
  type: QueueKind;
  client_ref: string;
  status: "created" | "duplicate" | "rejected" | "retry";
  id?: number;
  number?: string;
  error?: string;
};
