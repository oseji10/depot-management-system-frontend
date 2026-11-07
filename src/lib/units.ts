import type { Pack, ProductUnit } from "./types";

const plural = (n: number, name: string) => (Math.abs(n) === 1 ? name : `${name}s`);

/** 63 bottles in a 12-pack crate reads as "5 Crates + 3 Bottles". */
export function formatQty(qty: number, baseUnit: string | null, pack?: Pack | null): string {
  const base = baseUnit ?? "unit";
  if (!pack || Math.abs(qty) < pack.factor) return `${qty} ${plural(qty, base)}`;

  const packs = Math.trunc(qty / pack.factor);
  const rest = qty % pack.factor;
  return rest === 0 ? `${packs} ${plural(packs, pack.name)}` : `${packs} ${plural(packs, pack.name)} + ${rest} ${plural(rest, base)}`;
}

export function largestPack(units: ProductUnit[] | undefined): Pack | null {
  const packs = (units ?? []).filter((u) => u.is_active && !u.is_base && u.unit);
  if (!packs.length) return null;
  const biggest = packs.reduce((a, b) => (b.factor > a.factor ? b : a));
  return { name: biggest.unit!.name, factor: biggest.factor };
}

export const STATUS_LABEL: Record<string, string> = { saleable: "Saleable", damaged: "Damaged", expired: "Expired" };

export const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Opening balance",
  adjustment: "Adjustment",
  reclassify: "Reclassified",
  transfer_out: "Transfer out",
  transfer_in: "Transfer in",
  count_variance: "Count variance",
  receipt: "Goods received",
  receipt_reversal: "Receipt reversed",
};
