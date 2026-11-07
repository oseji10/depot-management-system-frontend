import type { InsightBucket } from "./types";

export const BUCKETS: { value: InsightBucket; label: string; hint: string; tone: "good" | "neutral" | "warn" | "bad" }[] = [
  { value: "active", label: "Bought this month", hint: "Within 30 days", tone: "good" },
  { value: "d31_90", label: "Quiet 1–3 months", hint: "31 to 90 days", tone: "neutral" },
  { value: "d91_180", label: "Quiet 3–6 months", hint: "91 to 180 days", tone: "warn" },
  { value: "d181_365", label: "Quiet 6–12 months", hint: "181 to 365 days", tone: "bad" },
  { value: "d365_plus", label: "Over a year", hint: "More than 365 days", tone: "bad" },
  { value: "never", label: "Never bought", hint: "No completed sale", tone: "neutral" },
];

export const GROUP_KINDS = [
  { value: "route", label: "Route" },
  { value: "location", label: "Location / area" },
  { value: "segment", label: "Type of customer" },
  { value: "other", label: "Other" },
];

/** Digits only in international form, for wa.me links. */
export function whatsappNumber(phone: string | null): string | null {
  const d = (phone ?? "").replace(/\D+/g, "");
  if (!d) return null;
  if (d.startsWith("234")) return d;
  if (d.startsWith("0")) return `234${d.slice(1)}`;
  return d.length === 10 ? `234${d}` : d;
}
