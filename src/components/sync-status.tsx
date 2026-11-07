"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatKobo, formatTime } from "../lib/format";
import type { QueueItem } from "../lib/offline/types";
import { useOffline } from "./offline-provider";
import { Button, ICON, Modal, Svg } from "./ui";

const KIND: Record<QueueItem["kind"], string> = { sale: "Sale", expense: "Expense", customer: "New customer" };

/** Always-visible answer to "is my work safe?": online or not, how many items are waiting, anything the depot turned down. */
export function SyncChip({ compact = false }: { compact?: boolean }) {
  const o = useOffline();
  const [open, setOpen] = useState(false);
  if (!o || !o.ready) return null;

  const tone =
    o.rejected > 0 || o.authExpired ? { dot: "bg-[#e5484d]", text: "Needs attention" }
    : !o.online ? { dot: "bg-amber-400", text: "Offline" }
    : o.syncing ? { dot: "bg-sky-400 animate-pulse", text: "Sending…" }
    : o.pending > 0 ? { dot: "bg-amber-400", text: "Waiting to send" }
    : { dot: "bg-emerald-300", text: "All sent" };

  const detail =
    o.authExpired ? "Sign in again to send"
    : o.rejected > 0 ? `${o.rejected} turned down`
    : o.pending > 0 ? `${o.pending} waiting`
    : o.online ? "Online" : "Saving on this phone";

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} aria-label={`${tone.text}. ${detail}. Open the queue.`}
        className={`flex items-center gap-2 rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 ${compact ? "px-2.5 py-1.5 text-xs" : "w-full justify-between rounded-xl px-3 py-2.5 text-sm"}`}
      >
        <span className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${tone.dot}`} />
          <span className="font-semibold">{compact ? (o.rejected > 0 ? `${o.rejected} to fix` : o.pending > 0 ? `${o.pending} waiting` : tone.text) : tone.text}</span>
        </span>
        {!compact && <span className="text-xs text-white/85">{detail}</span>}
      </button>
      {/* In a portal: the chip also sits inside the sidebar, whose white text and transform would otherwise leak into the dialog. */}
      {open && createPortal(<QueueModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function QueueModal({ onClose }: { onClose: () => void }) {
  const o = useOffline()!;
  const [refreshing, setRefreshing] = useState(false);
  const waiting = o.queue.filter((q) => q.status === "pending");
  const turnedDown = o.queue.filter((q) => q.status === "rejected");
  const sent = o.queue.filter((q) => q.status === "synced").slice(-8).reverse();

  return (
    <Modal title="Sales on this phone" onClose={onClose} wide>
      <div className={`rounded-xl px-4 py-3 text-sm font-medium ${o.online ? "bg-[#ffe9ea] text-[#a50006]" : "bg-amber-50 text-amber-800"}`}>
        {o.authExpired ? "Your sign-in has expired. Sign in again; everything below stays on this phone until it is sent."
          : o.online ? "You have a signal. Anything waiting is sent automatically."
          : "No signal. Keep selling: every sale is saved on this phone and sent when you are back online."}
      </div>

      {waiting.length === 0 && turnedDown.length === 0 && <p className="mt-5 text-center text-sm text-ink-soft">Nothing is waiting. Everything you did has reached the depot.</p>}

      {waiting.length > 0 && <Section title={`Waiting to send (${waiting.length})`}>{waiting.map((q) => <Row key={q.ref} q={q} />)}</Section>}

      {turnedDown.length > 0 && (
        <Section title={`Turned down (${turnedDown.length})`} tone="bad">
          <p className="mb-2 text-xs text-ink-soft">The depot has been told about these and a manager will deal with them. Do not sell them again.</p>
          {turnedDown.map((q) => <Row key={q.ref} q={q} onRemove={() => o.discard(q.ref)} />)}
        </Section>
      )}

      {sent.length > 0 && <Section title="Sent recently">{sent.map((q) => <Row key={q.ref} q={q} />)}</Section>}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" disabled={!o.online && !waiting.length} busy={o.syncing} onClick={() => o.sync()}>
          <Svg d={ICON.trend} /> Send now
        </Button>
        <Button
          variant="secondary" busy={refreshing} disabled={waiting.length > 0}
          title={waiting.length ? "Send what is waiting first" : undefined}
          onClick={async () => { setRefreshing(true); await o.refresh(); setRefreshing(false); }}
        >
          Update stock and prices
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-soft">
        {o.snapshot ? `Prices and stock downloaded at ${formatTime(o.snapshot.received_at)}.` : "Prices and stock have not been downloaded yet."}
      </p>
    </Modal>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "bad"; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className={`mb-2 text-xs font-bold tracking-wide uppercase ${tone === "bad" ? "text-[#c23a3a]" : "text-ink-soft"}`}>{title}</h3>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">{children}</ul>
    </div>
  );
}

function Row({ q, onRemove }: { q: QueueItem; onRemove?: () => void }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3.5 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-semibold">{q.status === "synced" && q.number ? `${q.number}${q.summary.customer ? ` · ${q.summary.customer}` : ""}` : q.summary.title}</p>
        <p className="text-xs text-ink-soft">{KIND[q.kind]} · {formatTime(q.created_at)}</p>
        {q.error && <p className="mt-1 text-xs font-medium text-[#c23a3a]">{q.error}</p>}
      </div>
      <div className="shrink-0 text-right">
        {q.kind !== "customer" && <p className="font-semibold">{formatKobo(q.summary.total)}</p>}
        {onRemove && <button type="button" onClick={onRemove} className="mt-1 text-xs font-semibold text-ink-soft hover:underline">Remove from phone</button>}
      </div>
    </li>
  );
}
