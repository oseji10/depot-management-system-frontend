"use client";

import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm transition placeholder:text-ink-soft/60 hover:border-[#ff3b3f]/40 focus:border-[#ff3b3f] focus:outline-none focus:ring-4 focus:ring-[#ff3b3f]/15 aria-[invalid=true]:border-[#c23a3a] disabled:bg-paper disabled:text-ink-soft";

export const filterClass =
  "min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm transition hover:border-[#ff3b3f]/40 focus:border-[#ff3b3f] focus:outline-none focus:ring-4 focus:ring-[#ff3b3f]/15";

export function Svg({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICON = {
  search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  chevron: "m6 9 6 6 6-6",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  left: "m15 6-6 6 6 6",
  right: "m9 6 6 6-6 6",
  doc: "M7 3h7l5 5v13H7V3ZM14 3v5h5M10 13h6M10 17h6",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6M9 20.5h.01M17 20.5h.01",
  cash: "M3 6h18v12H3V6ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6.5 9.5h.01M17.5 14.5h.01",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  alert: "M12 3 2 20h20L12 3ZM12 10v4M12 17h.01",
  people: "M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7v-7Z",
  minus: "M5 12h14",
  check: "m5 12 5 5 9-10",
  barcode: "M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "md" | "sm";
  busy?: boolean;
};

export function Button({ variant = "primary", size = "md", busy, className = "", children, disabled, ...rest }: ButtonProps) {
  const styles = {
    primary:
      "bg-gradient-to-b from-[#ff3b3f] to-[#f40009] text-white shadow-sm shadow-[#a50006]/30 hover:from-[#c40008] hover:to-[#a50006]",
    secondary: "border border-line bg-white text-ink shadow-sm hover:border-[#ff3b3f]/40 hover:bg-[#fff5f5]",
    danger: "border border-[#c23a3a]/30 bg-white text-[#c23a3a] hover:bg-red-50",
    ghost: "text-[#f40009] hover:bg-[#ffe9ea]",
  }[variant];
  const sizing = size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-4 text-sm";

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${styles} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy ? "Working…" : children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function Field({ label, error, hint, className = "", ...rest }: FieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = rest.type === "password";
  const input = (
    <input
      id={id}
      aria-invalid={!!error}
      aria-describedby={error || hint ? `${id}-msg` : undefined}
      className={`${inputClass} ${isPassword ? "pr-11" : ""}`}
      {...rest}
      type={isPassword && shown ? "text" : rest.type}
    />
  );
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-ink-soft transition hover:text-[#f40009]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              {shown ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6a11.6 11.6 0 0 1-2.6 3.2M6.5 7.6C4.4 9 3 11 2.5 12c1 1.8 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </>
              ) : (
                <>
                  <path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
      ) : (
        input
      )}
      {(error || hint) && (
        <p id={`${id}-msg`} className={`mt-1.5 text-xs ${error ? "text-[#c23a3a]" : "text-ink-soft"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  hint,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={`${inputClass} appearance-none pr-9`}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Svg d={ICON.chevron} className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" />
      </div>
      {(error || hint) && <p className={`mt-1.5 text-xs ${error ? "text-[#c23a3a]" : "text-ink-soft"}`}>{error ?? hint}</p>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad"; children: ReactNode }) {
  const styles = {
    neutral: "bg-paper text-ink-soft ring-line",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    bad: "bg-red-50 text-[#c23a3a] ring-red-200",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles}`}>{children}</span>;
}

export const StatusBadge = ({ active }: { active: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
      active ? "bg-[#ffe9ea] text-[#f40009] ring-[#ff3b3f]/25" : "bg-slate-100 text-slate-600 ring-slate-200"
    }`}
  >
    <span className={`size-1.5 rounded-full ${active ? "bg-[#ff3b3f]" : "bg-slate-400"}`} />
    {active ? "Active" : "Disabled"}
  </span>
);

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`animate-rise max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-paper">
            <Svg d={ICON.x} className="size-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action, crumb }: { title: string; description?: string; action?: ReactNode; crumb?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:mb-4">
      <div>
        {crumb && <p className="mb-1.5 text-xs font-semibold tracking-wide text-[#f40009]">{crumb}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.65rem]">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Section card with an optional title; the standard container for detail pages and forms. */
export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SectionTitle({ n, title, hint }: { n?: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {n && <span className="grid size-7 place-items-center rounded-lg bg-[#ffe9ea] text-xs font-bold text-[#f40009]">{n}</span>}
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-sm">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder, id = "search" }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string }) {
  return (
    <div className="relative min-w-52 max-w-md flex-1">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <Svg d={ICON.search} className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" />
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${filterClass} w-full pl-10`} />
    </div>
  );
}

export function FilterSelect({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${filterClass} appearance-none pr-9`}>
        {children}
      </select>
      <Svg d={ICON.chevron} className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" />
    </div>
  );
}

/** Table wrapper: rounded card with the green header row. */
export function TableCard({ children, min = "40rem" }: { children: ReactNode; min?: string }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
      <table className="w-full text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[#fff5f5]" style={{ minWidth: min }}>
        {children}
      </table>
    </div>
  );
}

export const theadClass = "border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase";
export const thClass = "px-4 py-3.5 font-semibold";

export function TableLoading({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-4">
              <div className={`h-3.5 animate-pulse rounded bg-line ${c === 0 ? "w-40" : "w-24"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TableEmpty({ cols, title, hint, icon = ICON.box }: { cols: number; title: string; hint?: string; icon?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-16">
        {/* sticky + viewport-wide so the message stays on screen when the table is wider than a phone */}
        <div className="sticky left-0 w-[min(100%,calc(100vw-4.5rem))] text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]">
            <Svg d={icon} className="size-7" />
          </span>
          <p className="mt-4 font-semibold">{title}</p>
          {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
        </div>
      </td>
    </tr>
  );
}

export function TableError({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-[#c23a3a]"><div className="sticky left-0 w-[min(100%,calc(100vw-4.5rem))] text-center">{message}</div></td>
    </tr>
  );
}

export function Pager({ page, last, total, current, setPage }: { page: number; last: number; total: number; current: number; setPage: (n: number) => void }) {
  if (last <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
      <span>
        Page <strong className="text-ink">{current}</strong> of {last} · {total} total
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <Svg d={ICON.left} /> Previous
        </Button>
        <Button variant="secondary" disabled={page >= last} onClick={() => setPage(page + 1)}>
          Next <Svg d={ICON.right} />
        </Button>
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#c23a3a]">{children}</p>;
}

/** A headline figure: label, big value, optional note. `tone` tints the icon chip. */
export function Stat({
  label, value, note, icon, tone = "green", href,
}: { label: string; value: ReactNode; note?: ReactNode; icon?: string; tone?: "green" | "amber" | "blue" | "rose"; href?: string }) {
  const chip = {
    green: "bg-[#ffe9ea] text-[#f40009] ring-[#ff3b3f]/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-soft">{label}</p>
        {icon && <span className={`grid size-8 shrink-0 place-items-center rounded-xl ring-1 sm:size-9 ${chip}`}><Svg d={icon} className="size-[18px]" /></span>}
      </div>
      <p className="mt-2 text-lg leading-tight font-bold tracking-tight break-words sm:text-[1.65rem] sm:leading-none">{value}</p>
      {note && <p className="mt-2 text-xs text-ink-soft">{note}</p>}
    </>
  );
  const cls = "block min-w-0 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition sm:p-5";
  return href ? <a href={href} className={`${cls} hover:border-[#ff3b3f]/40 hover:shadow-md`}>{body}</a> : <div className={cls}>{body}</div>;
}

/** Pill filters, e.g. Paid / Part paid / Unpaid. */
export function Chips<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition ${
              on ? "border-[#f40009] bg-[#f40009] text-white shadow-sm" : "border-line bg-white text-ink-soft hover:border-[#ff3b3f]/40 hover:text-ink"
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-paper"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Naira input that shows a currency prefix. The value is the text the user typed; convert with nairaToKobo. */
export function MoneyField({ label, value, onChange, error, hint, className = "", ...rest }: Omit<FieldProps, "onChange" | "type"> & { onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-ink-soft" aria-hidden="true">₦</span>
        <input
          id={id} inputMode="decimal" value={value} aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
          className={`${inputClass} pl-8`} {...rest}
        />
      </div>
      {(error || hint) && <p className={`mt-1.5 text-xs ${error ? "text-[#c23a3a]" : "text-ink-soft"}`}>{error ?? hint}</p>}
    </div>
  );
}

/** Small vertical bar chart (no axes library): one bar per point, labelled underneath. */
export function BarChart({ points, format }: { points: { label: string; value: number; hint?: string }[]; format: (v: number) => string }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex h-52 items-end gap-1.5 sm:gap-2" role="img" aria-label="Bar chart">
      {points.map((p, i) => (
        <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-[#f40009] to-[#ff7a7d] transition group-hover:from-[#a50006] group-hover:to-[#ff3b3f]"
            style={{ height: `${Math.max((p.value / max) * 100, p.value ? 4 : 1.5)}%`, opacity: p.value ? 1 : 0.25 }}
          />
          <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg group-hover:block">
            {p.hint ?? p.label}: {format(p.value)}
          </span>
          <span className="mt-2 truncate text-center text-[10px] text-ink-soft">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
