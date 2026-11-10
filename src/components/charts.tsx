"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatKobo } from "../lib/format";

/* Chart colours are tokens so light and dark swap in one place. The categorical order is fixed and never cycled; the
   single-measure charts use the brand red. */
export const CHART_CSS = `
.viz{color-scheme:light;--viz-surface:#ffffff;--viz-grid:#eadfdf;--viz-axis:#6b5a5a;--viz-ink:#261919;--viz-brand:#d9000a;--viz-brand-soft:rgba(244,0,9,.12);--viz-prev:#9a8a8a;
--viz-c1:#2a78d6;--viz-c2:#eb6834;--viz-c3:#1baf7a;--viz-c4:#eda100;--viz-c5:#e87ba4;--viz-other:#8f8a86;--viz-good:#0b7a35;--viz-bad:#b42318}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .viz{color-scheme:dark;--viz-surface:#1a1a19;--viz-grid:#3a3434;--viz-axis:#c3c2b7;--viz-ink:#f0efec;--viz-brand:#ff6b70;--viz-brand-soft:rgba(255,107,112,.16);--viz-prev:#8f8a86;--viz-c1:#3987e5;--viz-c2:#d95926;--viz-c3:#199e70;--viz-c4:#c98500;--viz-c5:#d55181;--viz-good:#4cc46f;--viz-bad:#ff8a80}}
:root[data-theme="dark"] .viz{color-scheme:dark;--viz-surface:#1a1a19;--viz-grid:#3a3434;--viz-axis:#c3c2b7;--viz-ink:#f0efec;--viz-brand:#ff6b70;--viz-brand-soft:rgba(255,107,112,.16);--viz-prev:#8f8a86;--viz-c1:#3987e5;--viz-c2:#d95926;--viz-c3:#199e70;--viz-c4:#c98500;--viz-c5:#d55181;--viz-good:#4cc46f;--viz-bad:#ff8a80}
`;

export const SERIES = ["var(--viz-c1)", "var(--viz-c2)", "var(--viz-c3)", "var(--viz-c4)", "var(--viz-c5)"];

export type Money = "kobo" | "count" | "plain";

export function compact(kobo: number, kind: Money = "kobo") {
  const v = kind === "kobo" ? kobo / 100 : kobo;
  const s = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  return kind === "kobo" ? `₦${s}` : s;
}

export const full = (v: number, kind: Money) => (kind === "kobo" ? formatKobo(v) : new Intl.NumberFormat("en-NG").format(v));

function niceMax(max: number) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Card with a title, an optional headline number, and a "table" switch so the numbers are never trapped in a picture. */
export function ChartCard({ title, value, sub, children, table, wide }: {
  title: string; value?: ReactNode; sub?: ReactNode; children: ReactNode; table?: { head: string[]; rows: (string | number)[][] }; wide?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`viz min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium text-ink-soft">{title}</h3>
          {value !== undefined && <p className="mt-0.5 text-xl font-bold tracking-tight">{value}</p>}
          {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-paper">
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {asTable && table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-ink-soft"><tr>{table.head.map((h, i) => <th key={h} className={`py-1.5 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`py-1.5 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  );
}

/** Change against the previous period. Arrow + words, never colour alone. `upIsGood=false` for costs and debts. */
export function Delta({ now, before, upIsGood = true }: { now: number; before: number; upIsGood?: boolean }) {
  if (before === 0 && now === 0) return <span className="text-ink-soft">no change</span>;
  if (before === 0) return <span className="text-ink-soft">new this period</span>;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-ink-soft">no change</span>;
  const up = pct > 0;
  const good = up === upIsGood;
  return (
    <span className="font-medium" style={{ color: good ? "var(--viz-good)" : "var(--viz-bad)" }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) >= 100 ? 0 : 1)}% <span className="font-normal text-ink-soft">vs previous period</span>
    </span>
  );
}

export function Stat({ label, value, delta, hint }: { label: string; value: string; delta?: ReactNode; hint?: string }) {
  return (
    <div className="viz min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight break-words sm:text-2xl" title={value}>{value}</p>
      {delta && <p className="mt-1 text-xs">{delta}</p>}
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}


/** Measured width of a chart box, so SVG text stays the same pixel size on a phone and on a wide screen. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const set = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [box, w];
}

type Point = { label: string; value: number; prev?: number };

/** Area line over time with a crosshair tooltip. The faint dashed line is the previous period, aligned by position. */
export function AreaChart({ points, kind = "kobo", name, height = 220 }: { points: Point[]; kind?: Money; name: string; height?: number }) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth();
  const H = height, L = 52, R = 12, T = 12, B = 26;
  const hasPrev = points.some((p) => p.prev !== undefined);
  const max = niceMax(Math.max(0, ...points.map((p) => Math.max(p.value, p.prev ?? 0))));
  const x = (i: number) => L + (points.length <= 1 ? (W - L - R) / 2 : (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = points.length ? `${line}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const prevLine = hasPrev ? points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.prev ?? 0).toFixed(1)}`).join("") : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const step = Math.max(1, Math.ceil(points.length / Math.max(3, Math.floor(W / 80))));

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !points.length) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const h = hover === null ? null : points[hover];

  return (
    <div className="relative" ref={box}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block w-full touch-pan-y" height={H} role="img" aria-label={`${name} over time. Peak ${full(Math.max(0, ...points.map((p) => p.value)), kind)}.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--viz-brand)" stopOpacity=".22" /><stop offset="1" stopColor="var(--viz-brand)" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--viz-axis)">{compact(t, kind)}</text>
          </g>
        ))}
        {points.map((p, i) => i % step === 0 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"} fontSize="11" fill="var(--viz-axis)">{p.label}</text>
        ) : null)}
        {area && <path d={area} fill={`url(#${id})`} />}
        {prevLine && <path d={prevLine} fill="none" stroke="var(--viz-prev)" strokeWidth="1.5" strokeDasharray="4 4" />}
        {line && <path d={line} fill="none" stroke="var(--viz-brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.length === 1 && <circle cx={x(0)} cy={y(points[0].value)} r="4" fill="var(--viz-brand)" stroke="var(--viz-surface)" strokeWidth="2" />}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="var(--viz-axis)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.value)} r="5" fill="var(--viz-brand)" stroke="var(--viz-surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 18), 82)}%`, transform: "translateX(-50%)" }}>
          <p className="font-medium">{h.label}</p>
          <p className="mt-1 flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: "var(--viz-brand)" }} />{name}: <b className="tabular-nums">{full(h.value, kind)}</b></p>
          {h.prev !== undefined && <p className="mt-0.5 flex items-center gap-1.5 text-ink-soft"><span className="inline-block h-0.5 w-2" style={{ background: "var(--viz-prev)" }} />Before: <span className="tabular-nums">{full(h.prev, kind)}</span></p>}
        </div>
      )}
      {hasPrev && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: "var(--viz-brand)" }} />This period</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--viz-prev)" }} />Previous period</span>
        </p>
      )}
    </div>
  );
}

/** Vertical columns, 4px rounded tops, one measure. Used for weekdays, hours, and counts over time. */
export function ColumnChart({ items, kind = "kobo", name, height = 190, highlightMax = false }: { items: { label: string; value: number }[]; kind?: Money; name: string; height?: number; highlightMax?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth();
  const H = height, L = 52, R = 8, T = 10, B = 26;
  const max = niceMax(Math.max(0, ...items.map((i) => i.value)));
  const slot = (W - L - R) / Math.max(items.length, 1);
  const bw = Math.min(34, Math.max(4, slot * 0.62));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const top = items.reduce((m, it, i) => (it.value > (items[m]?.value ?? -1) ? i : m), 0);
  const step = Math.max(1, Math.ceil(items.length / Math.max(3, Math.floor(W / 56))));

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} className="block w-full" role="img" aria-label={`${name}. Highest: ${items[top]?.label ?? "none"}.`} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t * max)} y2={y(t * max)} stroke="var(--viz-grid)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={L - 8} y={y(t * max) + 4} textAnchor="end" fontSize="11" fill="var(--viz-axis)">{compact(t * max, kind)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = L + slot * i + slot / 2;
          const h = Math.max(it.value > 0 ? 2 : 0, y(0) - y(it.value));
          const on = hover === i;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
              <path d={`M${cx - bw / 2},${y(0)}v${-Math.max(0, h - 4)}q0,-4 4,-4h${bw - 8}q4,0 4,4v${Math.max(0, h - 4)}z`} fill="var(--viz-brand)" opacity={highlightMax && i !== top && !on ? 0.45 : on ? 1 : 0.9} />
              {i % step === 0 && <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--viz-axis)">{it.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && items[hover] && (
        <div className="pointer-events-none absolute top-0 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(Math.max(((L + slot * hover + slot / 2) / W) * 100, 15), 85)}%`, transform: "translateX(-50%)" }}>
          <p className="font-medium">{items[hover].label}</p>
          <p className="mt-0.5">{name}: <b className="tabular-nums">{full(items[hover].value, kind)}</b></p>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars with the value written at the end (direct labels, no legend needed for one measure). */
export function RankBars({ items, kind = "kobo", empty = "Nothing in this period." }: { items: { label: string; value: number; note?: string }[]; kind?: Money; empty?: string }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-ink-soft">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`} title={`${it.label}: ${full(it.value, kind)}${it.note ? ` · ${it.note}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{full(it.value, kind)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-paper">
            <div className="h-full rounded-r-[4px] rounded-l-full" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: "var(--viz-brand)" }} />
          </div>
          {it.note && <p className="mt-0.5 text-xs text-ink-soft">{it.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Share of a total, as a ring with the legend (value and percent) beside it. Past five slices the tail folds into "Other". */
export function Donut({ items, kind = "kobo", centre }: { items: { label: string; value: number }[]; kind?: Money; centre?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, 5);
  const tail = sorted.slice(5).reduce((t, i) => t + i.value, 0);
  const slices = tail > 0 ? [...head, { label: "Other", value: tail }] : head;
  const total = slices.reduce((t, i) => t + i.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-ink-soft">No sales in this period.</p>;

  const R = 56, C = 2 * Math.PI * R, GAP = 2;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="relative mx-auto size-40 shrink-0 sm:mx-0 sm:size-44">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={`Share by ${slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)} percent`).join(", ")}`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--viz-grid)" strokeWidth="18" opacity=".35" />
          {slices.map((s, i) => {
            const len = (s.value / total) * C;
            const seg = (
              <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.label === "Other" ? "var(--viz-other)" : SERIES[i]} strokeWidth={hover === i ? 21 : 18}
                strokeDasharray={`${Math.max(0, len - (slices.length > 1 ? GAP : 0))} ${C}`} strokeDashoffset={-acc}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onPointerDown={() => setHover(i)} />
            );
            acc += len;
            return seg;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-ink-soft">{hover !== null ? slices[hover].label : (centre ?? "Total")}</p>
            <p className="text-sm font-bold tabular-nums">{compact(hover !== null ? slices[hover].value : total, kind)}</p>
          </div>
        </div>
      </div>
      <ul className="min-w-44 flex-1 space-y-2 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="flex min-w-0 items-center gap-2"><span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: s.label === "Other" ? "var(--viz-other)" : SERIES[i] }} /><span className="truncate">{s.label}</span></span>
            <span className="shrink-0 tabular-nums"><b>{full(s.value, kind)}</b> <span className="text-ink-soft">· {Math.round((s.value / total) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
