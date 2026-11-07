"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, ICON, Modal, PageHeader, SelectField, Stat, Svg, TableCard, TableEmpty, TableError, TableLoading, filterClass, theadClass, thClass } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatDateTime, formatKobo } from "../../../lib/format";
import type { BankAccount, PosTerminal, TerminalSummary } from "../../../lib/types";

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA"); };
const today = () => new Date().toLocaleDateString("en-CA");

export default function PosTerminalsPage() {
  const s = useSession();
  const canManage = s.can("terminals.manage");
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [editing, setEditing] = useState<PosTerminal | "new" | null>(null);

  const summary = useQuery({ queryKey: ["terminals", "summary", from, to], queryFn: () => api<TerminalSummary>(`/pos-terminals/summary?from=${from}&to=${to}`) });
  const list = useQuery({ queryKey: ["terminals", "list"], queryFn: () => api<{ data: PosTerminal[] }>("/pos-terminals") });
  const byId = new Map((list.data?.data ?? []).map((t) => [t.id, t]));

  return (
    <>
      <PageHeader
        title="Card terminals"
        description="Every card payment is tied to the machine that took it, so each machine's takings can be matched to the provider's settlement."
        action={canManage && <Button onClick={() => setEditing("new")}><Svg d={ICON.plus} /> Add terminal</Button>}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink-soft">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${filterClass} mt-1 block`} /></label>
        <label className="text-sm text-ink-soft">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${filterClass} mt-1 block`} /></label>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Card payments in this period" value={formatKobo(summary.data?.total ?? 0)} icon={ICON.cart} />
        <Stat label="Active terminals" value={(list.data?.data ?? []).filter((t) => t.is_active).length} icon={ICON.box} tone="blue" />
        <Stat label="Not tied to a terminal" value={formatKobo(summary.data?.untagged.total ?? 0)} note={summary.data?.untagged.payments ? `${summary.data.untagged.payments} older card payment${summary.data.untagged.payments === 1 ? "" : "s"}` : "None"} icon={ICON.alert} tone={summary.data?.untagged.total ? "amber" : "green"} />
      </div>

      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr><th className={thClass}>Terminal</th><th className={thClass}>Branch</th><th className={`${thClass} text-right`}>Payments</th><th className={`${thClass} text-right`}>Takings</th><th className={thClass}>Last used</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {summary.isLoading && <TableLoading cols={6} />}
          {summary.error && <TableError cols={6} message={(summary.error as Error).message} />}
          {summary.data && summary.data.data.length === 0 && <TableEmpty cols={6} title="No card terminals yet" hint="Add each machine, with the terminal ID printed on it. Card payments then have to name the machine that took them." />}
          {summary.data?.data.map((t) => (
            <tr key={t.id} className={t.is_active ? "" : "opacity-60"}>
              <td className="px-4 py-3.5">
                <Link href={`/pos-terminals/view?id=${t.id}`} className="font-semibold text-[#f40009] hover:underline">{t.name}</Link>
                <p className="text-xs text-ink-soft">{[t.provider, t.terminal_id && `TID ${t.terminal_id}`].filter(Boolean).join(" · ") || "–"}{!t.is_active && " · inactive"}</p>
              </td>
              <td className="px-4 py-3.5">{t.branch ?? <span className="text-ink-soft">Any branch</span>}</td>
              <td className="px-4 py-3.5 text-right">{t.payments}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(t.total)}</td>
              <td className="px-4 py-3.5 text-ink-soft">{t.last_at ? formatDateTime(t.last_at) : "–"}</td>
              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                <Link href={`/pos-terminals/view?id=${t.id}`} className="mr-3 text-sm font-semibold text-[#f40009] hover:underline">Transactions</Link>
                {canManage && byId.get(t.id) && <button type="button" onClick={() => setEditing(byId.get(t.id)!)} className="text-sm font-semibold text-[#f40009] hover:underline">Edit</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {editing && (
        <TerminalModal terminal={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ["terminals"] }); }} />
      )}
    </>
  );
}

function TerminalModal({ terminal, onClose, onSaved }: { terminal: PosTerminal | null; onClose: () => void; onSaved: () => void }) {
  const branches = useOptions("/branches");
  const users = useOptions("/users");
  const accounts = useQuery({ queryKey: ["bank-accounts"], queryFn: () => api<{ data: BankAccount[] }>("/bank-accounts") });
  const [v, setV] = useState({
    name: terminal?.name ?? "", provider: terminal?.provider ?? "", terminal_id: terminal?.terminal_id ?? "", merchant_id: terminal?.merchant_id ?? "",
    serial_number: terminal?.serial_number ?? "", branch_id: String(terminal?.branch_id ?? ""), assigned_user_id: String(terminal?.assigned_user_id ?? ""),
    account_id: String(terminal?.account_id ?? ""), notes: terminal?.notes ?? "", is_active: terminal?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const text = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const num = (x: string) => (x ? Number(x) : null);

  const save = useMutation({
    mutationFn: () => api(terminal ? `/pos-terminals/${terminal.id}` : "/pos-terminals", {
      method: terminal ? "PUT" : "POST",
      body: {
        name: v.name, provider: v.provider || null, terminal_id: v.terminal_id || null, merchant_id: v.merchant_id || null, serial_number: v.serial_number || null,
        branch_id: num(v.branch_id), assigned_user_id: num(v.assigned_user_id), account_id: num(v.account_id), notes: v.notes || null, is_active: v.is_active,
      },
    }),
    onSuccess: onSaved,
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? { name: [e.message] }) : { name: [e.message] }),
  });

  const bankAccounts = (accounts.data?.data ?? []).filter((a) => a.is_active && !a.is_main);

  return (
    <Modal title={terminal ? `Edit ${terminal.name}` : "Add card terminal"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
        <Field label="Name" value={v.name} onChange={text("name")} error={errors.name?.[0]} placeholder="Counter 1" hint="What staff call it." required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider or bank" value={v.provider} onChange={text("provider")} error={errors.provider?.[0]} placeholder="Moniepoint" />
          <Field label="Terminal ID (TID)" value={v.terminal_id} onChange={text("terminal_id")} error={errors.terminal_id?.[0]} hint="As on the device and the provider's reports." />
          <Field label="Merchant ID (optional)" value={v.merchant_id} onChange={text("merchant_id")} error={errors.merchant_id?.[0]} />
          <Field label="Serial number (optional)" value={v.serial_number} onChange={text("serial_number")} error={errors.serial_number?.[0]} />
          <SelectField label="Branch" value={v.branch_id} onChange={(x) => setV((s) => ({ ...s, branch_id: x }))} options={[{ value: "", label: "Any branch" }, ...branches]} error={errors.branch_id?.[0]} />
          <SelectField label="Carried by (optional)" value={v.assigned_user_id} onChange={(x) => setV((s) => ({ ...s, assigned_user_id: x }))} options={[{ value: "", label: "Shared" }, ...users]}
            hint="A salesperson who takes it on the road. Others cannot use it." error={errors.assigned_user_id?.[0]} />
        </div>
        <SelectField label="Settles into" value={v.account_id} onChange={(x) => setV((s) => ({ ...s, account_id: x }))}
          options={[{ value: "", label: "Main Bank account" }, ...bankAccounts.map((a) => ({ value: a.id, label: a.bank_name ? `${a.name} · ${a.bank_name}` : a.name }))]}
          hint="The bank account this machine's money lands in. Add one on the Bank accounts page if it is not listed." error={errors.account_id?.[0]} />
        <Field label="Notes (optional)" value={v.notes} onChange={text("notes")} />
        {terminal && (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={v.is_active} onChange={(e) => setV((s) => ({ ...s, is_active: e.target.checked }))} className="size-4 accent-[#f40009]" />
            Terminal is in use
          </label>
        )}
        {Object.keys(errors).length > 0 && !errors.name && <ErrorNote>Check the highlighted fields.</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!v.name.trim()}>{terminal ? "Save changes" : "Add terminal"}</Button>
        </div>
      </form>
    </Modal>
  );
}
