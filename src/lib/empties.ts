import type { ContainerType, EmptiesMode, PosProduct } from "./types";

type Line = { product: PosProduct; unit: { factor: number }; qty: number };

export type EmptiesRow = { type: ContainerType; sold: number; returned: number; held: number; deposit: number };

/** Containers a cart puts into the customer's hands. Must match ContainerService::required on the server. */
export function containersNeeded(cart: Line[]): Map<number, number> {
  const need = new Map<number, number>();
  const add = (id: number, n: number) => need.set(id, (need.get(id) ?? 0) + n);

  for (const l of cart) {
    const base = l.qty * l.unit.factor;
    if (l.product.bottle_container_id) add(l.product.bottle_container_id, base);
    const size = l.product.crate_size ?? 0;
    if (l.product.crate_container_id && size > 0 && l.unit.factor >= size) add(l.product.crate_container_id, Math.floor(base / size));
  }

  return need;
}

/**
 * What a sale does to containers: deposit due, and how many each customer ends up holding.
 * Deposit customers (and walk-ins) pay for every container not swapped for an empty; balance customers pay nothing.
 */
export function emptiesPlan(cart: Line[], types: ContainerType[], mode: EmptiesMode, returned: Record<number, number>): { deposit: number; rows: EmptiesRow[] } {
  if (mode === "none") return { deposit: 0, rows: [] };

  const need = containersNeeded(cart);
  const rows: EmptiesRow[] = [];
  let deposit = 0;

  for (const type of types) {
    const sold = need.get(type.id) ?? 0;
    if (sold === 0) continue;
    const back = Math.max(0, Math.min(returned[type.id] ?? 0, mode === "deposit" ? sold : 100000));
    const held = sold - back;
    const dep = mode === "deposit" ? Math.max(0, held) * type.deposit : 0;
    deposit += dep;
    rows.push({ type, sold, returned: back, held, deposit: dep });
  }

  return { deposit, rows };
}

export const emptiesPayload = (rows: EmptiesRow[]) =>
  rows.filter((r) => r.returned > 0).map((r) => ({ container_type_id: r.type.id, quantity: r.returned }));
