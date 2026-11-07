export type SheetColumn = { name: string; required?: boolean; date?: boolean };

export type ParsedSheet = {
  rows: Record<string, unknown>[];
  /** Required columns the file does not have. */
  missing: string[];
  /** How many rows the file holds in total. */
  found: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel stores dates as a day count. Read it as written in the sheet (no time-zone shifting) -> "2026-10-29 18:28:07". */
export function excelDate(value: unknown): string | null {
  if (value instanceof Date) value = value.getTime() / 86400000 + 25569;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value !== "number" || !isFinite(value)) return null;
  const d = new Date(Math.round((value - 25569) * 86400) * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Reads the first sheet of an .xlsx/.xls/.csv file in the browser and keeps only the columns the import uses. */
export async function readSheet(file: File, columns: SheetColumn[]): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("That file has no sheets in it.");

  const all = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const headers = new Set(all.length ? Object.keys(all[0]) : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []).map(String));
  const missing = columns.filter((c) => c.required && !headers.has(c.name)).map((c) => c.name);

  const rows = all.map((raw, i) => {
    const row: Record<string, unknown> = { _row: i + 2 };
    for (const c of columns) {
      const v = raw[c.name];
      if (v === null || v === undefined || v === "") continue;
      row[c.name] = c.date ? excelDate(v) : v;
    }
    return row;
  });

  return { rows, missing, found: rows.length };
}
