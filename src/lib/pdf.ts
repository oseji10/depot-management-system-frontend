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
