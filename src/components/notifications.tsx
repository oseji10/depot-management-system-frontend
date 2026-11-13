"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "../hooks/session";
import { Modal } from "./ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

export type AppNotification = {
  id: number; kind: string; severity: "success" | "info" | "warning" | "alert"; title: string; body: string | null; url: string | null; created_at: string; read: boolean;
};
type Feed = { data: AppNotification[]; unread: number };

const TILE = {
  success: "bg-gradient-to-br from-[#ff3b3f] to-[#f40009] text-white",
  info: "bg-gradient-to-br from-sky-500 to-sky-700 text-white",
  warning: "bg-gradient-to-br from-amber-400 to-amber-600 text-white",
  alert: "bg-gradient-to-br from-rose-500 to-rose-700 text-white",
} as const;

const ICON = {
  milestone: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z",
  stock: "M3 7l9-4 9 4v10l-9 4-9-4V7Zm9 4v10M3 7l9 4 9-4",
  expiry: "M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  fleet: "M3 16V7h11v9M14 10h4l3 3v3h-3M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  sync: "M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5",
  approval: "M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  payroll: "M4 7h16v10H4V7Zm8 2.5v5M9.5 12h5",
  billing: "M3 7h18v10H3V7Zm0 3.5h18M7 14.5h3",
} as Record<string, string>;

function Glyph({ n, className = "size-5" }: { n: AppNotification; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICON[n.kind] ?? ICON.approval} />
    </svg>
  );
}

/** Head-office users only: van salesmen and branch users have no depot-wide notifications. */
function useFeed() {
  const s = useSession();
  const enabled = !s.van && s.level !== "branch";
  return useQuery({ queryKey: ["notifications"], enabled, refetchInterval: 45_000, refetchIntervalInBackground: true, queryFn: () => api<Feed>("/notifications") });
}

function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) => api("/notifications/read", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** The bell with an unread dot, and the list that drops down from it. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const feed = useFeed();
  const mark = useMarkRead();
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<string>("unsupported");
  const [prefs, setPrefs] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => { if (typeof Notification !== "undefined") setPerm(Notification.permission); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (box.current && !box.current.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!feed.data) return null;
  const unread = feed.data.unread;

  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7ZM10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[#ff4d4f] px-1 text-[11px] leading-5 font-bold text-white ring-2 ring-[#f40009]">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && createPortal(
        <div ref={panel} role="dialog" aria-label="Notifications" className="fixed top-16 right-3 z-[60] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl sm:right-6 lg:top-4 lg:right-auto lg:left-[17rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-bold">Notifications</p>
            {unread > 0 && <button type="button" className="text-xs font-semibold text-[#f40009] hover:underline" onClick={() => mark.mutate({ all: true })}>Mark all as read</button>}
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {feed.data.data.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-soft">Nothing yet. Milestones and things that need attention will show up here.</li>}
            {feed.data.data.map((n) => (
              <li key={n.id} className={n.read ? "" : "bg-[#fff1f1]"}>
                <div className="flex gap-3 px-4 py-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TILE[n.severity]}`}><Glyph n={n} /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{n.title}</p>
                    {n.body && <p className="text-ink-soft">{n.body}</p>}
                    <p className="mt-1 flex items-center gap-3 text-xs text-ink-soft">
                      {formatDateTime(n.created_at)}
                      {n.url && <Link href={n.url} onClick={() => { mark.mutate({ ids: [n.id] }); setOpen(false); }} className="font-semibold text-[#f40009] hover:underline">Open page</Link>}
                      {!n.read && <button type="button" onClick={() => mark.mutate({ ids: [n.id] })} className="hover:underline">Mark read</button>}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line bg-paper px-4 py-3 text-sm">
            <button type="button" className="font-semibold text-[#f40009] hover:underline" onClick={() => { setPrefs(true); setOpen(false); }}>Email alerts</button>
            <p className="text-xs text-ink-soft">Choose which alerts also arrive in your inbox.</p>
          </div>
          {perm === "default" && (
            <div className="border-t border-line bg-paper px-4 py-3 text-sm">
              <button type="button" className="font-semibold text-[#f40009] hover:underline" onClick={async () => { try { setPerm(await Notification.requestPermission()); } catch { /* unsupported */ } }}>Turn on desktop alerts</button>
              <p className="text-xs text-ink-soft">Get a pop-up on your computer even when this tab is in the background.</p>
            </div>
          )}
        </div>,
        document.body,
      )}
      {prefs && createPortal(<EmailAlertsModal onClose={() => setPrefs(false)} />, document.body)}
    </div>
  );
}

type EmailPrefs = { email: string; enabled: boolean; kinds: string[] | null; available: { key: string; label: string }[] };

/** One person's choice of which alerts are also emailed to them. */
function EmailAlertsModal({ onClose }: { onClose: () => void }) {
  const q = useQuery({ queryKey: ["email-prefs"], queryFn: () => api<EmailPrefs>("/notifications/email") });
  const [enabled, setEnabled] = useState(true);
  const [kinds, setKinds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!q.data || ready) return;
    setEnabled(q.data.enabled);
    setKinds(q.data.kinds ?? q.data.available.map((a) => a.key));
    setReady(true);
  }, [q.data, ready]);

  const save = useMutation({
    mutationFn: () => api<EmailPrefs>("/notifications/email", { method: "PUT", body: { enabled, kinds: q.data && kinds.length === q.data.available.length ? null : kinds } }),
    onSuccess: () => { setSaved(true); setTimeout(onClose, 700); },
  });

  const toggle = (k: string) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <Modal title="Email alerts" onClose={onClose}>
      {!q.data ? (
        <p className="text-sm text-ink-soft">{q.isError ? "Could not load your settings." : "Loading…"}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Alerts are sent to <strong className="text-ink">{q.data.email}</strong>. They also keep showing in the bell.</p>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3.5 text-sm font-semibold">
            Send me email alerts
            <input type="checkbox" className="size-5 accent-[#f40009]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>
          <div className={`space-y-2 ${enabled ? "" : "pointer-events-none opacity-50"}`}>
            {q.data.available.map((a) => (
              <label key={a.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                {a.label}
                <input type="checkbox" className="size-5 accent-[#f40009]" checked={kinds.includes(a.key)} onChange={() => toggle(a.key)} />
              </label>
            ))}
          </div>
          {save.isError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">Could not save. Try again.</p>}
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending || saved}
            className="w-full rounded-xl bg-[#f40009] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a50006] disabled:opacity-60">
            {saved ? "Saved" : save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </Modal>
  );
}

/**
 * Pop-up cards in the corner when something new arrives, and (once allowed) a desktop notification when the tab is hidden.
 * Only notifications newer than the last one this browser has already shown are announced.
 */
export function NotificationToasts() {
  const s = useSession();
  const feed = useFeed();
  const mark = useMarkRead();
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const key = `depot-notified-${s.user.id}`;

  useEffect(() => {
    const items = feed.data?.data;
    if (!items) return;

    let last = 0;
    try { last = Number(localStorage.getItem(key) ?? 0); } catch { /* storage blocked */ }

    const newest = items.reduce((m, n) => Math.max(m, n.id), 0);
    // First visit on this browser: announce only what is both unread and recent, so old news does not pile up.
    const fresh = items.filter((n) => !n.read && n.id > last && (last > 0 || Date.now() - new Date(n.created_at).getTime() < 15 * 60_000)).reverse().slice(-3);

    try { localStorage.setItem(key, String(Math.max(last, newest))); } catch { /* storage blocked */ }
    if (fresh.length === 0) return;

    setToasts((cur) => [...cur, ...fresh.filter((f) => !cur.some((c) => c.id === f.id))]);

    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      for (const n of fresh) {
        try {
          const note = new Notification(n.title, { body: n.body ?? undefined, tag: `depot-${n.id}` });
          note.onclick = () => { window.focus(); if (n.url) window.location.href = n.url; note.close(); };
        } catch { /* some browsers only allow service-worker notifications */ }
      }
    }
  }, [feed.data, key]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((cur) => cur.slice(1)), 14_000);
    return () => clearTimeout(t);
  }, [toasts]);

  const dismiss = (id: number) => { setToasts((cur) => cur.filter((t) => t.id !== id)); mark.mutate({ ids: [id] }); };

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-[70] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-3 sm:right-5 sm:bottom-5 print:hidden" aria-live="polite">
      {toasts.map((n) => (
        <div key={n.id} role="status" className="pointer-events-auto animate-[toast-in_.35s_ease-out] overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <div className="flex gap-3">
            <span className={`grid size-12 shrink-0 place-items-center rounded-xl shadow-md ${TILE[n.severity]}`}><Glyph n={n} className="size-6" /></span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="leading-snug font-bold">{n.title}</p>
              {n.body && <p className="mt-0.5 text-ink-soft">{n.body}</p>}
            </div>
            <button type="button" onClick={() => dismiss(n.id)} aria-label="Dismiss" className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-paper">✕</button>
          </div>
          {n.url && (
            <Link href={n.url} onClick={() => dismiss(n.id)} className="mt-3 block rounded-xl bg-paper py-2 text-center text-sm font-semibold text-[#f40009] hover:bg-[#ffe9ea]">Open page</Link>
          )}
        </div>
      ))}
    </div>
  );
}
