/** Reading a bank statement exported as Excel or CSV. Every bank lays its columns out differently, so the person maps them. */

export type Table = { headers: string[]; rows: unknown[][] };
export type Mapping = { date: number; description: number; reference: number; debit: number; credit: number; amount: number; balance: number };
export type StatementLine = { date: string; description: string; reference: string; amount: number };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** First sheet as rows; the header row is the first one with at least three filled-in text cells. */
export async function readTable(file: File): Promise<Table> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("That file has no sheets in it.");
  const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
  const at = all.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim()).length >= 3);
  if (at < 0) throw new Error("Could not find a row of column headings in that file.");
  return { headers: all[at].map((c, i) => (c == null || String(c).trim() === "" ? `Column ${i + 1}` : String(c).trim())), rows: all.slice(at + 1) };
}

const find = (headers: string[], words: string[]) => headers.findIndex((h) => words.some((w) => h.toLowerCase().includes(w)));

export function guessMapping(headers: string[]): Mapping {
  return {
    date: find(headers, ["trans date", "transaction date", "post date", "value date", "date"]),
    description: find(headers, ["narration", "description", "details", "remark", "particulars"]),
    reference: find(headers, ["reference", "ref", "session"]),
    debit: find(headers, ["debit", "withdraw", "money out", "paid out"]),
    credit: find(headers, ["credit", "deposit", "money in", "paid in"]),
    amount: find(headers, ["amount"]),
    balance: find(headers, ["balance"]),
  };
}

export function parseDate(v: unknown): string | null {
  if (typeof v === "number" && isFinite(v) && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400) * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); // Nigerian banks write day first
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -,]*(\d{2,4})/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(+m[1])}`;
  return null;
}

/** "1,250.50", "(1,250.50)", "-1250.5" -> kobo, null when not a number. */
export function parseKobo(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  const neg = /^\(.*\)$/.test(v.trim()) || v.trim().startsWith("-");
  const n = Number(v.replace(/[^0-9.]/g, ""));
  if (v.replace(/[^0-9.]/g, "") === "" || !isFinite(n)) return null;
  return Math.round(n * 100) * (neg ? -1 : 1);
}

export function toLines(table: Table, map: Mapping): { lines: StatementLine[]; skipped: number } {
  const lines: StatementLine[] = [];
  let skipped = 0;
  for (const r of table.rows) {
    const date = map.date >= 0 ? parseDate(r[map.date]) : null;
    let amount: number | null = null;
    if (map.amount >= 0) amount = parseKobo(r[map.amount]);
    if (amount == null || amount === 0) {
      const out = map.debit >= 0 ? parseKobo(r[map.debit]) : null;
      const inn = map.credit >= 0 ? parseKobo(r[map.credit]) : null;
      amount = (inn ? Math.abs(inn) : 0) - (out ? Math.abs(out) : 0);
    }
    if (!date || !amount) { skipped++; continue; }
    lines.push({ date, amount, description: String(map.description >= 0 ? r[map.description] ?? "" : "").slice(0, 255), reference: String(map.reference >= 0 ? r[map.reference] ?? "" : "").slice(0, 120) });
  }
  return { lines, skipped };
}
