"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A date box that always reads DD/MM/YYYY (whatever language the browser is set to) with a calendar button.
 * The value in and out is the usual "YYYY-MM-DD" string ("" when empty), the same as a native date input.
 * You can type the date (slashes are added for you) or pick it from the calendar.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };

/** "2026-11-24" → "24/11/2026" */
export const toDmy = (v?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** "24/11/2026", "24-11-2026", "24.11.26" or "24112026" → "2026-11-24", or null when it is not a real date. */
export function fromDmy(text: string): string | null {
  const t = text.trim();
  let d: number, m: number, y: number;
  const parts = t.split(/[/.\-\s]+/).filter(Boolean);
  if (parts.length === 3 && parts[0].length === 4) [y, m, d] = parts.map(Number); // 2026-11-24
  else if (parts.length === 3) [d, m, y] = parts.map(Number);
  else if (/^\d{8}$/.test(t)) [d, m, y] = [Number(t.slice(0, 2)), Number(t.slice(2, 4)), Number(t.slice(4))];
  else return null;
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 100) y += 2000;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(y, m, 0).getDate()) return null;
  return iso(y, m - 1, d);
}

/** Adds the slashes while typing: "2411" → "24/11", "24112026" → "24/11/2026". */
function autoSlash(raw: string, prev: string): string {
  if (raw.length < prev.length) return raw; // deleting: leave it alone
  const digits = raw.replace(/\D/g, "");
  if (/[^\d/]/.test(raw) || raw.includes("/")) {
    // they are typing their own separators; only add one after a 2-digit day or month
    return /^\d{2}$|^\d{1,2}\/\d{2}$/.test(raw) ? `${raw}/` : raw;
  }
  if (digits.length <= 2) return digits.length === 2 ? `${digits}/` : digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}${digits.length === 4 ? "/" : ""}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  /** Classes for the outer box (default: inline). Use "relative block w-full" to fill the width. */
  wrapperClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function DateInput({ value, onChange, min, max, className = "", wrapperClassName = "relative inline-block", placeholder = "DD/MM/YYYY", ...rest }: DateInputProps) {
  const [text, setText] = useState(toDmy(value));
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => { if (!focused) { setText(toDmy(value)); setBad(false); } }, [value, focused]);

  const inRange = (v: string) => (!min || v >= min) && (!max || v <= max);

  const type = (raw: string) => {
    const next = autoSlash(raw, text).slice(0, 10);
    setText(next);
    if (next.trim() === "") { setBad(false); if (value !== "") onChange(""); return; }
    const v = fromDmy(next);
    const ok = !!v && next.replace(/\D/g, "").length >= 6 && inRange(v);
    setBad(!ok && next.length >= 8);
    if (ok && v !== value) onChange(v!);
  };

  const pick = (v: string) => { onChange(v); setText(toDmy(v)); setBad(false); setOpen(false); };

  return (
    <span ref={box} className={wrapperClassName}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        size={10}
        value={text}
        placeholder={placeholder}
        onChange={(e) => type(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(toDmy(value)); setBad(false); }}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); setOpen(true); } }}
        aria-invalid={rest["aria-invalid"] || bad || undefined}
        title={bad ? `Type the date as DD/MM/YYYY${min || max ? `, between ${toDmy(min) || "any"} and ${toDmy(max) || "any"}` : ""}` : undefined}
        className={`${className} pr-10 tabular-nums`}
      />
      <button
        type="button"
        disabled={rest.disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open calendar"
        aria-expanded={open}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-xl text-ink-soft transition hover:text-[#f40009] disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>
      {open && <Calendar anchor={box} value={value} min={min} max={max} onPick={pick} onClear={rest.required ? undefined : () => pick("")} onClose={() => setOpen(false)} />}
    </span>
  );
}

function Calendar({ anchor, value, min, max, onPick, onClear, onClose }: {
  anchor: React.RefObject<HTMLSpanElement | null>; value: string; min?: string; max?: string;
  onPick: (v: string) => void; onClear?: () => void; onClose: () => void;
}) {
  const start = value || (max && todayIso() > max ? max : min && todayIso() < min ? min : todayIso());
  const [view, setView] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const W = 288, H = 340;

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const top = below >= H + 8 || r.top < H + 8 ? r.bottom + 6 : r.top - H - 6;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor]);

  useEffect(() => {
    // Escape closes the calendar only (not the window it sits in); a click outside closes it.
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); } };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    window.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down, true);
    return () => { window.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", down, true); };
  }, [anchor, onClose]);

  const today = todayIso();
  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const move = (by: number) => setView((v) => { const d = new Date(v.y, v.m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const thisYear = new Date().getFullYear();
  const yFrom = Math.min(min ? Number(min.slice(0, 4)) : thisYear - 80, view.y);
  const yTo = Math.max(max ? Number(max.slice(0, 4)) : thisYear + 10, view.y);
  const ok = (v: string) => (!min || v >= min) && (!max || v <= max);
  const sel = "min-h-8 rounded-lg border border-line bg-white px-1.5 text-sm font-semibold focus:border-[#ff3b3f] focus:outline-none";

  if (typeof document === "undefined" || !pos) return null;
  return createPortal(
    <div ref={panel} role="dialog" aria-label="Choose a date" style={{ top: pos.top, left: pos.left, width: W }}
      className="fixed z-[1000] rounded-2xl border border-line bg-white p-3 text-ink shadow-xl">
      <div className="mb-2 flex items-center gap-1">
        <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg hover:bg-paper">‹</button>
        <select aria-label="Month" value={view.m} onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))} className={`${sel} flex-1`}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select aria-label="Year" value={view.y} onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))} className={sel}>
          {Array.from({ length: yTo - yFrom + 1 }, (_, i) => yTo - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" onClick={() => move(1)} aria-label="Next month" className="grid size-8 place-items-center rounded-lg hover:bg-paper">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-ink-soft">
        {DAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const v = iso(view.y, view.m, d);
          const chosen = v === value, isToday = v === today, allowed = ok(v);
          return (
            <button key={i} type="button" disabled={!allowed} onClick={() => onPick(v)} aria-pressed={chosen} aria-label={toDmy(v)}
              className={`grid h-9 place-items-center rounded-lg text-sm tabular-nums transition disabled:cursor-not-allowed disabled:text-ink-soft/35 ${chosen ? "bg-[#f40009] font-semibold text-white" : isToday ? "font-semibold text-[#f40009] ring-1 ring-inset ring-[#f40009]/40 hover:bg-[#f40009]/10" : "hover:bg-paper"}`}>
              {d}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm">
        {onClear ? <button type="button" onClick={onClear} className="rounded-lg px-2 py-1 text-ink-soft hover:bg-paper">Clear</button> : <span />}
        <button type="button" disabled={!ok(today)} onClick={() => onPick(today)} className="rounded-lg px-2 py-1 font-semibold text-[#f40009] hover:bg-[#f40009]/10 disabled:opacity-40">Today</button>
      </div>
    </div>,
    document.body,
  );
}
