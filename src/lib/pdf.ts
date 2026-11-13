/** A tiny table-to-PDF writer (A4 landscape, Helvetica). No libraries needed, so it works offline too. */
export type Letterhead = { name: string; lines: string[] };
export type Logo = { bytes: Uint8Array; w: number; h: number };
export type PdfTable = { title: string; subtitle?: string; head: string[]; widths: number[]; right: boolean[]; rows: string[][]; foot?: string[] };

const W = 842, H = 595, M = 30; // A4 landscape in points
const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1"); // plain Latin text only

function fit(s: string, w: number, size: number) {
  const max = Math.floor(w / (size * 0.5));
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + "." : s;
}

/** Turn a picture (data/blob URL) into JPEG bytes on a white background, for embedding in the PDF. */
export async function logoJpeg(src: string): Promise<Logo | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    if (!x) return null;
    x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
    const bin = atob(c.toDataURL("image/jpeg", 0.9).split(",")[1]);
    return { bytes: Uint8Array.from(bin, (ch) => ch.charCodeAt(0)), w, h };
  } catch { return null; }
}

export function tablePdf(t: PdfTable, head?: Letterhead, logo?: Logo | null): Blob {
  const total = t.widths.reduce((a, b) => a + b, 0);
  const cols = t.widths.map((w) => (w / total) * (W - 2 * M));
  const xs = cols.map((_, i) => M + cols.slice(0, i).reduce((a, b) => a + b, 0));
  const pages: string[] = [];
  let out = "";
  let y = 0;
  const text = (s: string, x: number, yy: number, size: number, bold = false, right = false, w = 0) => {
    const v = fit(esc(s), w || 400, size);
    const tw = v.length * size * 0.5;
    out += `BT /${bold ? "F2" : "F1"} ${size} Tf ${(right ? x + w - tw - 4 : x + 4).toFixed(1)} ${yy.toFixed(1)} Td (${v}) Tj ET\n`;
  };
  const line = (yy: number) => { out += `0.8 G ${M} ${yy.toFixed(1)} m ${W - M} ${yy.toFixed(1)} l S\n`; };
  const row = (cells: string[], bold: boolean) => {
    cells.forEach((c, i) => text(c, xs[i], y, 8, bold, t.right[i], cols[i]));
    y -= 6; line(y); y -= 12;
  };
  const start = () => {
    if (out) pages.push(out);
    out = ""; y = H - M;
    if (head) {
      const lh = 46;
      let tx = M - 4;
      if (logo) {
        const k = Math.min(lh / logo.h, 150 / logo.w);
        out += `q ${(logo.w * k).toFixed(1)} 0 0 ${(logo.h * k).toFixed(1)} ${M} ${(y - lh).toFixed(1)} cm /Im1 Do Q\n`;
        tx = M + logo.w * k + 10;
      }
      text(head.name, tx, y - 14, 15, true, false, 600);
      head.lines.slice(0, 3).forEach((l, i) => text(l, tx, y - 27 - i * 10, 8.5, false, false, 600));
      y -= lh + 6; line(y); y -= 16;
    }
    text(t.title, M - 4, y, 14, true, false, 700); y -= 14;
    if (t.subtitle) { text(t.subtitle, M - 4, y, 9, false, false, 700); y -= 14; }
    y -= 6; row(t.head, true);
  };
  start();
  t.rows.forEach((r) => { if (y < M + 20) start(); row(r, false); });
  if (t.foot) { if (y < M + 20) start(); row(t.foot, true); }
  pages.push(out);

  const objs: string[] = [];
  const n = pages.length;
  const base = logo ? 6 : 5; // first page object
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${base + i * 2} 0 R`).join(" ")}] /Count ${n} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  if (logo) {
    const data = Array.from(logo.bytes, (b) => String.fromCharCode(b)).join("");
    objs[5] = `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n${data}\nendstream`;
  }
  const xo = logo ? " /XObject << /Im1 5 0 R >>" : "";
  pages.forEach((c, i) => {
    objs[base + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo} >> /Contents ${base + 1 + i * 2} 0 R >>`;
    objs[base + 1 + i * 2] = `<< /Length ${c.length} >>\nstream\n${c}endstream`;
  });
  let pdf = "%PDF-1.4\n";
  const off: number[] = [];
  for (let i = 1; i < objs.length; i++) { off[i] = pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(pdf, (ch) => ch.charCodeAt(0) & 255)], { type: "application/pdf" });
}

export function downloadBlob(filename: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export type ReceiptPdfInput = {
  business: { name: string; lines: string[] };
  title: string; // RECEIPT or INVOICE
  meta: [string, string][]; // label / value pairs under the number
  number: string;
  when: string;
  items: { name: string; detail: string; total: string }[];
  totals: { label: string; value: string; bold?: boolean }[];
  note?: string;
  footer?: string;
};

/** A narrow one-page receipt (80 mm wide, as long as it needs to be), so it reads well in WhatsApp and prints on a till roll. */
export function receiptPdf(r: ReceiptPdfInput, logo?: Logo | null): Blob {
  const W2 = 227, M2 = 12, inner = W2 - 2 * M2;
  type Op = { t: "text"; s: string; x: number; y: number; size: number; bold: boolean; align: "l" | "r" | "c" } | { t: "rule"; y: number; dashed?: boolean };
  const ops: Op[] = [];
  let y = M2;
  const wrap = (s: string, size: number, width: number, bold = false) => {
    const fits = (t: string) => helvWidth(t, size, bold) <= width;
    const words = esc(s).split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let cur = "";
    for (let w of words) {
      if (cur && !fits(`${cur} ${w}`)) { rows.push(cur); cur = ""; }
      while (!fits(w) && w.length > 1) { let n = w.length - 1; while (n > 1 && !fits(w.slice(0, n))) n--; rows.push(w.slice(0, n)); w = w.slice(n); }
      cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) rows.push(cur);
    return rows.length ? rows : [""];
  };
  const put = (s: string, size: number, o: { bold?: boolean; align?: "l" | "r" | "c"; x?: number; width?: number; gap?: number } = {}) => {
    const rows = wrap(s, size, o.width ?? inner, !!o.bold);
    for (const row of rows) { y += size; ops.push({ t: "text", s: row, x: o.x ?? M2, y, size, bold: !!o.bold, align: o.align ?? "l" }); y += (o.gap ?? 2.5); }
  };
  const pair = (a: string, b: string, size = 8.5, bold = false) => {
    const right = esc(b);
    const left = wrap(a, size, inner - helvWidth(right, size, bold) - 8, bold);
    left.forEach((row, i) => {
      y += size;
      ops.push({ t: "text", s: row, x: M2, y, size, bold, align: "l" });
      if (i === 0) ops.push({ t: "text", s: right, x: M2, y, size, bold, align: "r" });
      y += 2.5;
    });
  };
  const rule = (dashed = true) => { y += 3; ops.push({ t: "rule", y, dashed }); y += 5; };

  let logoH = 0, logoW = 0;
  if (logo) { const k = Math.min(40 / logo.h, 120 / logo.w); logoW = logo.w * k; logoH = logo.h * k; }
  const logoY = y;
  if (logo) y += logoH + 4;
  put(r.business.name, 12, { bold: true, align: "c" });
  r.business.lines.forEach((l) => put(l, 7.5, { align: "c" }));
  rule();
  put(`${r.title} ${r.number}`, 9.5, { bold: true, align: "c" });
  put(r.when, 8, { align: "c" });
  y += 2;
  r.meta.forEach(([a, b]) => pair(a, b, 8));
  rule();
  r.items.forEach((it) => { pair(it.name, it.total, 8.5, true); put(it.detail, 7.5, { gap: 4 }); });
  rule();
  r.totals.forEach((t) => pair(t.label, t.value, t.bold ? 10 : 8.5, !!t.bold));
  if (r.note) { y += 3; put(r.note, 8, { bold: true }); }
  rule();
  put(r.footer ?? "Thank you for your patronage.", 8, { align: "c" });
  const H2 = Math.ceil(y + M2);

  let c = "";
  const X = (op: Extract<Op, { t: "text" }>) => {
    const tw = helvWidth(op.s, op.size, op.bold);
    return op.align === "r" ? W2 - M2 - tw : op.align === "c" ? (W2 - tw) / 2 : op.x;
  };
  if (logo) c += `q ${logoW.toFixed(1)} 0 0 ${logoH.toFixed(1)} ${((W2 - logoW) / 2).toFixed(1)} ${(H2 - logoY - logoH).toFixed(1)} cm /Im1 Do Q\n`;
  for (const op of ops) {
    if (op.t === "rule") c += `0.6 G ${op.dashed ? "[2 2] 0 d" : "[] 0 d"} ${M2} ${(H2 - op.y).toFixed(1)} m ${W2 - M2} ${(H2 - op.y).toFixed(1)} l S\n`;
    else c += `BT /${op.bold ? "F2" : "F1"} ${op.size} Tf ${X(op).toFixed(1)} ${(H2 - op.y).toFixed(1)} Td (${op.s.replace(/([\\()])/g, "\\$1")}) Tj ET\n`;
  }

  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Kids [5 0 R] /Count 1 >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const xo = logo ? " /XObject << /Im1 7 0 R >>" : "";
  objs[5] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W2} ${H2}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo} >> /Contents 6 0 R >>`;
  objs[6] = `<< /Length ${c.length} >>\nstream\n${c}endstream`;
  if (logo) {
    const data = Array.from(logo.bytes, (b) => String.fromCharCode(b)).join("");
    objs[7] = `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n${data}\nendstream`;
  }
  let pdf = "%PDF-1.4\n";
  const off: number[] = [];
  for (let i = 1; i < objs.length; i++) { off[i] = pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(pdf, (ch) => ch.charCodeAt(0) & 255)], { type: "application/pdf" });
}

// Advance widths (1/1000 em) of Helvetica and Helvetica-Bold for characters 32..126, so centring and wrapping use the real text width.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
function helvWidth(s: string, size: number, bold: boolean): number {
  const t = bold ? HELV_BOLD : HELV;
  let w = 0;
  for (const ch of s) { const c = ch.charCodeAt(0); w += (c >= 32 && c <= 126 ? t[c - 32] : 556); }
  return (w * size) / 1000;
}
