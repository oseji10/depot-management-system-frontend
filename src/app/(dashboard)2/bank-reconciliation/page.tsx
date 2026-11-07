"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Card, ErrorNote, Modal, PageHeader, SelectField, TableCard, TableEmpty, TableError, TableLoading, Svg, theadClass, thClass, ICON } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { guessMapping, parseKobo, readTable, toLines, type Mapping, type Table } from "../../../lib/bank-statement";
import { formatDate, formatKobo } from "../../../lib/format";

type Statement = { id: number; name: string; period_from: string; period_to: string; lines_count: number; open_count: number; account?: { name: string; code: string } };

const FIELDS: { key: keyof Mapping; label: string; hint?: string }[] = [
  { key: "date", label: "Date" }, { key: "description", label: "Description" }, { key: "reference", label: "Reference (optional)" },
  { key: "debit", label: "Money out column", hint: "Debit / Withdrawal" }, { key: "credit", label: "Money in column", hint: "Credit / Deposit" },
  { key: "amount", label: "One amount column (if there is no in/out split)", hint: "Negative = money out" }, { key: "balance", label: "Balance (to read the closing balance)" },
];

export default function BankReconciliationPage() {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["bank-statements"], queryFn: () => api<{ data: Statement[] }>("/bank-statements") });

  return (
    <div>
      <PageHeader title="Bank reconciliation" description="Upload a bank or card-provider statement and tick it off against your books."
        action={s.can("accounts.manage") ? <Button onClick={() => setOpen(true)}><Svg d={ICON.plus} /> Upload statement</Button> : undefined} />
      <TableCard min="40rem">
        <thead className={theadClass}>
          <tr><th scope="col" className={`${thClass} px-5`}>Statement</th><th scope="col" className={thClass}>Account</th><th scope="col" className={thClass}>Period</th><th scope="col" className={`${thClass} text-right`}>Still to sort out</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={4} />}
          {q.error && <TableError cols={4} message={(q.error as Error).message} />}
          {q.data && q.data.data.length === 0 && <TableEmpty cols={4} title="No statements yet" hint="Download your statement from the bank as Excel or CSV and upload it here." icon={ICON.doc} />}
          {q.data?.data.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-3.5"><Link href={`/bank-reconciliation/view?id=${r.id}`} className="font-semibold hover:underline">{r.name}</Link><span className="block text-xs text-ink-soft">{r.lines_count} lines</span></td>
              <td className="px-4 py-3.5">{r.account?.name}</td>
              <td className="px-4 py-3.5 text-ink-soft">{formatDate(r.period_from.slice(0, 10))} to {formatDate(r.period_to.slice(0, 10))}</td>
              <td className={`px-4 py-3.5 text-right font-semibold ${r.open_count ? "text-amber-700" : "text-[#f40009]"}`}>{r.open_count ? `${r.open_count} lines` : "All matched"}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {open && <UploadModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const accounts = useQuery({ queryKey: ["bank-accounts"], queryFn: () => api<{ data: { id: number; code: string; name: string }[] }>("/bank-statements/accounts") });
  const [account, setAccount] = useState("");
  const [table, setTable] = useState<Table | null>(null);
  const [name, setName] = useState("");
  const [map, setMap] = useState<Mapping | null>(null);
  const [error, setError] = useState("");

  const pick = async (f?: File) => {
    if (!f) return;
    setError("");
    try { const t = await readTable(f); setTable(t); setMap(guessMapping(t.headers)); setName(f.name.replace(/\.[^.]+$/, "")); } catch (e) { setError((e as Error).message); }
  };

  const parsed = table && map ? toLines(table, map) : null;
  const hasAmount = !!map && (map.amount >= 0 || map.debit >= 0 || map.credit >= 0);
  // The last balance in the file is the closing balance, when the statement lists them in date order.
  const closing = table && map && map.balance >= 0 ? [...table.rows].reverse().map((r) => parseKobo(r[map.balance])).find((v) => v != null) ?? null : null;

  const run = useMutation({
    mutationFn: () => api<{ statement: { id: number }; auto_matched: number }>("/bank-statements", { method: "POST", body: { account_id: Number(account), name, closing_balance: closing, lines: parsed!.lines } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["bank-statements"] }); router.push(`/bank-reconciliation/view?id=${r.statement.id}&auto=${r.auto_matched}`); },
  });

  const opts = table ? [{ value: "-1", label: "— none —" }, ...table.headers.map((h, i) => ({ value: String(i), label: h }))] : [];

  return (
    <Modal title="Upload a bank statement" onClose={onClose} wide>
      <div className="space-y-4">
        <SelectField label="Which account is this statement for?" value={account} onChange={setAccount} options={[{ value: "", label: "Choose…" }, ...(accounts.data?.data ?? []).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))]} />
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="secondary" onClick={() => input.current?.click()}>{table ? "Choose a different file" : "Choose the Excel or CSV file"}</Button>
        {error && <ErrorNote>{error}</ErrorNote>}
        {table && map && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => <SelectField key={f.key} label={f.label} hint={f.hint} value={String(map[f.key])} onChange={(v) => setMap({ ...map, [f.key]: Number(v) })} options={opts} />)}
            </div>
            <Card>
              <p className="text-sm">{parsed ? <><b>{parsed.lines.length}</b> lines read{parsed.skipped > 0 && <>, {parsed.skipped} rows skipped (no date or amount)</>}.{closing != null && <> Closing balance {formatKobo(closing)}.</>}</> : null}</p>
              {parsed && parsed.lines.slice(0, 3).map((l, i) => <p key={i} className="text-xs text-ink-soft">{l.date} · {l.description.slice(0, 50)} · {formatKobo(l.amount)}</p>)}
            </Card>
          </>
        )}
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={run.isPending} disabled={!account || !name || !parsed?.lines.length || !hasAmount || map?.date === -1} onClick={() => run.mutate()}>Import and match</Button>
        </div>
      </div>
    </Modal>
  );
}
