export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });

export const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);

export const formatDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** Ledger amounts arrive as integer kobo. */
export const formatKobo = (kobo: number) => formatNaira(kobo / 100);

/** Plain number with thousands separators and 2 decimals, for statement columns. */
export const formatAmount = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kobo / 100);

/** "App\\Modules\\Procurement\\Models\\GoodsReceipt" -> "Goods Receipt"; null means a hand-written entry. */
export const sourceLabel = (type: string | null) => {
  const name = type?.split("\\").pop();
  return name ? name.replace(/([a-z])([A-Z])/g, "$1 $2") : "Manual";
};

/** What the user typed in a naira box ("1,250.50") as integer kobo. Empty or invalid gives 0. */
export const nairaToKobo = (text: string) => {
  const n = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/** Kobo as the plain text for an input box: 125050 -> "1250.5". */
export const koboToInput = (kobo: number) => (kobo ? String(kobo / 100) : "");

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

/** "Today", "Yesterday" or the date. */
export const relativeDay = (iso: string) => {
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};
