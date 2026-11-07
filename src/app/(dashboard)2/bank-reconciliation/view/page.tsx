"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, ErrorNote, Field, Modal, PageHeader, SelectField, TableCard, theadClass, thClass } from "../../../../components/ui";
import { withSuspense } from "../../../../components/suspense-page";
import { useOptions } from "../../../../hooks/options";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatKobo } from "../../../../lib/format";

type LedgerLine = { id: number; date: string; number: string; memo: string; amount: number };
type Line = { id: number; txn_date: string; description: string | null; reference: string | null; amount: number; status: "unmatched" | "matched" | "ignored"; note: string | null; ledger: LedgerLine[] };
type View = {
  statement: { id: number; name: string; period_from: string; period_to: string; closing_balance: number | null; account?: { name: string } };
  lines: Line[]; ledger_open: LedgerLine[];
  summary: { statement_closing: number | null; ledger_balance: number; difference: number | null; unmatched_statement: number; unmatched_statement_count: number; unmatched_ledger: number; unmatched_ledger_count: number; matched_count: number; ignored_count: number };
};

function ReconciliationPage() {
  const id = useIdParam();
  const s = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = s.can("accounts.manage");
  const [dialog, setDialog] = useState<{ kind: "match" | "book" | "ignore"; line: Line } | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const q = useQuery({ queryKey: ["bank-statement", id], queryFn: () => api<View>(`/bank-statements/${id}`) });
  const put = (v: View) => { qc.setQueryData(["bank-statement", id], v); qc.invalidateQueries({ queryKey: ["bank-statements"] }); qc.invalidateQueries({ queryKey: ["report"] }); };
  const act = useMutation({ mutationFn: (p: { path: string; body?: unknown; method?: string }) => api<View>(`/bank-statements/${id}${p.path}`, { method: p.method ?? "POST", body: p.body }), onSuccess: put });
  const remove = useMutation({ mutationFn: () => api(`/bank-statements/${id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-statements"] }); router.push("/bank-reconciliation"); } });

  const d = q.data;
  if (!d) return <p className="text-sm text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p>;
  const sm = d.summary;
  const shown = d.lines.filter((l) => filter === "all" || l.status === "unmatched");

  return (
    <div>
      <PageHeader crumb={<Link href="/bank-reconciliation" className="hover:underline">← All statements</Link>} title={d.statement.name}
        description={`${d.statement.account?.name} · ${formatDate(d.statement.period_from.slice(0, 10))} to ${formatDate(d.statement.period_to.slice(0, 10))}`}
        action={canEdit ? <div className="flex gap-2"><Button variant="secondary" busy={act.isPending} onClick={() => act.mutate({ path: "/auto-match" })}>Match again</Button><Button variant="danger" onClick={() => confirm("Delete this statement? Your books are not touched.") && remove.mutate()}>Delete</Button></div> : undefined} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-ink-soft">Bank says</p><p className="mt-0.5 text-xl font-bold">{sm.statement_closing == null ? "–" : formatKobo(sm.statement_closing)}</p></Card>
        <Card><p className="text-sm text-ink-soft">Your books say</p><p className="mt-0.5 text-xl font-bold">{formatKobo(sm.ledger_balance)}</p></Card>
        <Card><p className="text-sm text-ink-soft">Difference</p><p className={`mt-0.5 text-xl font-bold ${sm.difference ? "text-amber-700" : "text-[#f40009]"}`}>{sm.difference == null ? "–" : formatKobo(sm.difference)}</p></Card>
        <Card><p className="text-sm text-ink-soft">Matched</p><p className="mt-0.5 text-xl font-bold">{sm.matched_count} <span className="text-sm font-normal text-ink-soft">of {d.lines.length}</span></p></Card>
      </div>
      {(sm.unmatched_statement_count > 0 || sm.unmatched_ledger_count > 0) && (
        <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          {sm.unmatched_statement_count} bank lines ({formatKobo(sm.unmatched_statement)}) are not in your books yet, and {sm.unmatched_ledger_count} entries in your books ({formatKobo(sm.unmatched_ledger)}) are not on the statement.
          Bank charges, interest and unrecorded deposits can be booked straight from the line.
        </p>
      )}
      {act.error && <div className="mb-3"><ErrorNote>{(act.error as Error).message}</ErrorNote></div>}

      <div className="mb-3 flex gap-2">
        <Button variant={filter === "open" ? "primary" : "secondary"} onClick={() => setFilter("open")}>To sort out ({sm.unmatched_statement_count})</Button>
        <Button variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>Everything</Button>
      </div>
      <TableCard min="52rem">
        <thead className={theadClass}><tr><th scope="col" className={`${thClass} px-5`}>Bank line</th><th scope="col" className={`${thClass} text-right`}>Amount</th><th scope="col" className={thClass}>In your books</th><th scope="col" className={`${thClass} text-right`}>Action</th></tr></thead>
        <tbody className="divide-y divide-line">
          {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-soft">Nothing left to sort out.</td></tr>}
          {shown.map((l) => (
            <tr key={l.id}>
              <td className="px-5 py-3.5"><span className="font-medium">{l.description || "(no description)"}</span><span className="block text-xs text-ink-soft">{formatDate(l.txn_date)}{l.reference ? ` · ${l.reference}` : ""}</span></td>
              <td className={`px-4 py-3.5 text-right font-semibold ${l.amount < 0 ? "text-[#c23a3a]" : ""}`}>{formatKobo(l.amount)}</td>
              <td className="px-4 py-3.5 text-xs text-ink-soft">
                {l.status === "matched" && <>{l.ledger.map((m) => <span key={m.id} className="block">{m.number} · {m.memo}</span>)}{l.note && <Badge tone="good">{l.note}</Badge>}</>}
                {l.status === "ignored" && <Badge tone="neutral">Ignored: {l.note}</Badge>}
                {l.status === "unmatched" && <Badge tone="warn">Not matched</Badge>}
              </td>
              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                {canEdit && l.status === "unmatched" && (
                  <>
                    <button className="mr-3 text-sm font-semibold text-[#f40009] hover:underline" onClick={() => setDialog({ kind: "match", line: l })}>Match</button>
                    <button className="mr-3 text-sm font-semibold text-[#f40009] hover:underline" onClick={() => setDialog({ kind: "book", line: l })}>Book it</button>
                    <button className="text-sm text-ink-soft hover:underline" onClick={() => setDialog({ kind: "ignore", line: l })}>Ignore</button>
                  </>
                )}
                {canEdit && l.status !== "unmatched" && <button className="text-sm text-ink-soft hover:underline" onClick={() => act.mutate({ path: `/lines/${l.id}/unmatch` })}>Undo</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">In your books but not matched to the bank ({d.ledger_open.length})</h2>
      <TableCard min="36rem">
        <tbody className="divide-y divide-line">
          {d.ledger_open.length === 0 && <tr><td className="px-5 py-6 text-center text-ink-soft">Every entry has a bank line.</td></tr>}
          {d.ledger_open.map((o) => <tr key={o.id}><td className="px-5 py-3 text-ink-soft">{formatDate(o.date)}</td><td className="px-4 py-3">{o.number} · {o.memo}</td><td className="px-4 py-3 text-right font-semibold">{formatKobo(o.amount)}</td></tr>)}
        </tbody>
      </TableCard>

      {dialog?.kind === "match" && <MatchModal line={dialog.line} open={d.ledger_open} onClose={() => setDialog(null)} onSubmit={(ids) => act.mutate({ path: `/lines/${dialog.line.id}/match`, body: { journal_line_ids: ids } }, { onSuccess: () => setDialog(null) })} busy={act.isPending} error={act.error as Error | null} />}
      {dialog?.kind === "book" && <BookModal line={dialog.line} onClose={() => setDialog(null)} onSubmit={(b) => act.mutate({ path: `/lines/${dialog.line.id}/book`, body: b }, { onSuccess: () => setDialog(null) })} busy={act.isPending} />}
      {dialog?.kind === "ignore" && <IgnoreModal onClose={() => setDialog(null)} onSubmit={(note) => act.mutate({ path: `/lines/${dialog.line.id}/ignore`, body: { note } }, { onSuccess: () => setDialog(null) })} busy={act.isPending} />}
    </div>
  );
}

function MatchModal({ line, open, onClose, onSubmit, busy, error }: { line: Line; open: LedgerLine[]; onClose: () => void; onSubmit: (ids: number[]) => void; busy: boolean; error: Error | null }) {
  const [picked, setPicked] = useState<number[]>([]);
  // Same-sign entries nearest in date first.
  const list = open.filter((o) => Math.sign(o.amount) === Math.sign(line.amount)).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(line.txn_date)) - Math.abs(Date.parse(b.date) - Date.parse(line.txn_date)));
  const sum = list.filter((o) => picked.includes(o.id)).reduce((a, o) => a + o.amount, 0);

  return (
    <Modal title={`Match ${formatKobo(line.amount)}`} onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Tick the entries in your books this bank line pays for. Together they must add up to the bank amount.</p>
        <div className="max-h-72 overflow-auto rounded-xl border border-line">
          {list.length === 0 && <p className="p-4 text-sm text-ink-soft">No unmatched entries in your books on this side. Use “Book it” to record this line.</p>}
          {list.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
              <input type="checkbox" checked={picked.includes(o.id)} onChange={() => setPicked(picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id])} />
              <span className="flex-1">{formatDate(o.date)} · {o.number} · {o.memo}</span><span className="font-semibold">{formatKobo(o.amount)}</span>
            </label>
          ))}
        </div>
        <p className={`text-sm font-medium ${sum === line.amount ? "text-[#f40009]" : ""}`}>Picked {formatKobo(sum)} of {formatKobo(line.amount)}</p>
        {error && <ErrorNote>{error.message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={sum !== line.amount || picked.length === 0} onClick={() => onSubmit(picked)}>Match</Button></div>
      </div>
    </Modal>
  );
}

function BookModal({ line, onClose, onSubmit, busy }: { line: Line; onClose: () => void; onSubmit: (b: { account_id: number; memo: string }) => void; busy: boolean }) {
  const accounts = useOptions("/accounts");
  const [account, setAccount] = useState("");
  const [memo, setMemo] = useState(line.description ?? "");
  return (
    <Modal title="Record in your books" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{line.amount < 0 ? `Money left the bank: ${formatKobo(-line.amount)}. Which account is it for, for example Bank charges?` : `Money came into the bank: ${formatKobo(line.amount)}. Which account is it from, for example Interest income?`}</p>
        <SelectField label="Account" value={account} onChange={setAccount} options={[{ value: "", label: "Choose…" }, ...accounts]} />
        <Field label="Note" value={memo} onChange={(e) => setMemo(e.target.value)} />
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!account} onClick={() => onSubmit({ account_id: Number(account), memo })}>Record and match</Button></div>
      </div>
    </Modal>
  );
}

function IgnoreModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (note: string) => void; busy: boolean }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="Ignore this line" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Why?" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. belongs to another business" autoFocus />
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!note.trim()} onClick={() => onSubmit(note)}>Ignore</Button></div>
      </div>
    </Modal>
  );
}

export default withSuspense(ReconciliationPage);
