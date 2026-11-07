export const VEHICLE_TYPES = { truck: "Truck", van: "Van", pickup: "Pickup", motorbike: "Motorbike", other: "Other" } as const;
export const FUEL_TYPES = { petrol: "Petrol", diesel: "Diesel", gas: "Gas", electric: "Electric" } as const;
export const VEHICLE_STATUS = { active: "Available", in_workshop: "In workshop", retired: "Retired" } as const;
export const VEHICLE_TONE = { active: "good", in_workshop: "warn", retired: "neutral" } as const;
export const DOC_KINDS = { insurance: "Insurance", roadworthiness: "Roadworthiness", vehicle_license: "Vehicle licence", proof_of_ownership: "Proof of ownership", other: "Other" } as const;
export const SERVICE_KINDS = { service: "Service", repair: "Repair", tyres: "Tyres", accident: "Accident", other: "Other" } as const;

/** How a document's expiry date reads today. */
export function docState(expires: string | null): { label: string; tone: "good" | "warn" | "bad" | "neutral" } {
  if (!expires) return { label: "No expiry", tone: "neutral" };
  const days = Math.floor((new Date(`${expires}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  if (days < 0) return { label: `Expired ${-days} day${days === -1 ? "" : "s"} ago`, tone: "bad" };
  if (days <= 30) return { label: days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`, tone: "warn" };
  return { label: "Valid", tone: "good" };
}
