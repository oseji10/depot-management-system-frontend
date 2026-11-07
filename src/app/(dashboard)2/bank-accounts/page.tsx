"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, ICON, Modal, PageHeader, StatusBadge, Svg, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatKobo } from "../../../lib/format";
import type { BankAccount } from "../../../lib/types";

export default function BankAccountsPage() {
  const s = useSession();
  const canManage = s.can("accounts.manage");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const list = useQuery({ queryKey: ["bank-accounts"], queryFn: () => api<{ data: BankAccount[] }>("/bank-accounts") });

  return (
    <>
      <PageHeader
        title="Bank accounts"
        description="The accounts your customers pay into. Cashiers and salespeople pick one whenever a sale is paid by bank transfer, and the money is recorded against it."
        action={canManage && <Button onClick={() => setEditing("new")}><Svg d={ICON.plus} /> Add bank account</Button>}
      />

      <TableCard min="44rem">
        <thead className={theadClass}>
          <tr><th className={thClass}>Account</th><th className={thClass}>Bank</th><th className={thClass}>Account number</th><th className={thClass}>Used by</th><th className={`${thClass} text-right`}>Balance</th><th className={thClass}>Status</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={7} />}
          {list.error && <TableError cols={7} message={(list.error as Error).message} />}
          {list.data && list.data.data.length === 0 && <TableEmpty cols={7} title="No bank accounts yet" hint="Add the accounts customers transfer into." />}
          {list.data?.data.map((a) => (
            <tr key={a.id} className={a.is_active ? "" : "opacity-60"}>
              <td className="px-4 py-3.5">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{a.name} {a.is_main && <Badge>Main</Badge>}</span>
                {a.account_name && <p className="text-xs text-ink-soft">{a.account_name}</p>}
              </td>
              <td className="px-4 py-3.5">{a.bank_name ?? <span className="text-ink-soft">–</span>}</td>
              <td className="px-4 py-3.5 font-mono text-xs">{a.account_number ?? "–"}</td>
              <td className="px-4 py-3.5 text-xs text-ink-soft">{a.terminals.length ? a.terminals.map((t) => t.name).join(", ") : "Direct transfers"}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(a.balance)}</td>
              <td className="px-4 py-3.5"><StatusBadge active={a.is_active} /></td>
              <td className="px-4 py-3.5 text-right">
                {canManage && <button type="button" onClick={() => setEditing(a)} className="text-sm font-semibold text-[#f40009] hover:underline">Edit</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <p className="mt-3 text-xs text-ink-soft">Each account also appears on the chart of accounts, so its balance feeds your reports. A card machine&apos;s money goes to the account chosen on its Card terminals page.</p>

      {editing && (
        <BankAccountModal account={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }); queryClient.invalidateQueries({ queryKey: ["pos"] }); queryClient.invalidateQueries({ queryKey: ["accounts"] }); }} />
      )}
    </>
  );
}

function BankAccountModal({ account, onClose, onSaved }: { account: BankAccount | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    name: account?.name ?? "", bank_name: account?.bank_name ?? "", account_number: account?.account_number ?? "", account_name: account?.account_name ?? "", is_active: account?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const text = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => api(account ? `/bank-accounts/${account.id}` : "/bank-accounts", {
      method: account ? "PUT" : "POST",
      body: { name: v.name.trim(), bank_name: v.bank_name.trim(), account_number: v.account_number.trim() || null, account_name: v.account_name.trim() || null, ...(account ? { is_active: v.is_active } : {}) },
    }),
    onSuccess: onSaved,
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? { name: [e.message] }) : { name: [e.message] }),
  });

  return (
    <Modal title={account ? `Edit ${account.name}` : "Add bank account"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
        <Field label="Name staff will see" value={v.name} onChange={text("name")} error={errors.name?.[0]} placeholder="GTBank collections" hint="Short, so it is easy to pick at the till." required />
        <Field label="Bank" value={v.bank_name} onChange={text("bank_name")} error={errors.bank_name?.[0]} placeholder="GTBank" required />
        <Field label="Account number" value={v.account_number} onChange={(e) => setV((x) => ({ ...x, account_number: e.target.value.replace(/\D/g, "").slice(0, 20) }))} error={errors.account_number?.[0]} inputMode="numeric" placeholder="0123456789" />
        <Field label="Account name (optional)" value={v.account_name} onChange={text("account_name")} error={errors.account_name?.[0]} placeholder="Alpha Depot Ltd" />
        {account && !account.is_main && (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={v.is_active} onChange={(e) => setV((x) => ({ ...x, is_active: e.target.checked }))} className="size-4 accent-[#f40009]" />
            Account is in use <span className="text-xs text-ink-soft">(switch off to stop offering it at the till)</span>
          </label>
        )}
        {errors.is_active && <ErrorNote>{errors.is_active[0]}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!v.name.trim() || !v.bank_name.trim()}>{account ? "Save changes" : "Add account"}</Button>
        </div>
      </form>
    </Modal>
  );
}
