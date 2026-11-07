"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate, formatKobo, nairaToKobo } from "../../../lib/format";
import type { Paginated, StaffCharge } from "../../../lib/types";

const TONE = { pending: "warn", approved: "warn", cleared: "good", rejected: "bad", waived: "neutral" } as const;
const LABEL = { pending: "Awaiting approval", approved: "Being recovered", cleared: "Fully recovered", rejected: "Rejected", waived: "Waived" } as const;
const REASON = { damage: "Damaged product", shortage: "Shortage", loss: "Lost item", other: "Other" } as const;

export default function StaffChargesPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);

  const list = useQuery({ queryKey: ["staff-charges", status], queryFn: () => api<Paginated<StaffCharge>>(`/staff-charges?per_page=100${status ? `&status=${status}` : ""}`) });
  const act = useMutation({
    mutationFn: ({ id, path, note }: { id: number; path: string; note?: string }) => api(`/staff-charges/${id}/${path}`, { method: "POST", body: note ? { note } : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-charges"] }),
  });
  const ask = (id: number, path: string, question: string) => { const note = window.prompt(question); if (note) act.mutate({ id, path, note }); };
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader
        title="Staff charges"
        description="Money an employee owes the business, such as a product they damaged. Once approved it is taken from their salary in instalments."
        action={s.can("staff-charges.manage") && <Button onClick={() => setOpen(true)}>Charge an employee</Button>}
      />
      <div className="mb-3">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">All charges</option>
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {act.error && <div className="mb-3"><ErrorNote>{(act.error as Error).message}</ErrorNote></div>}
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Charge</th><th className={th}>Employee</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Recovered</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.isLoading ? <TableLoading cols={6} /> : list.error ? <TableError cols={6} message={(list.error as Error).message} />
              : (list.data?.data.length ?? 0) === 0 ? <TableEmpty cols={6} title="No staff charges" hint="Charge an employee when they damage or lose something." />
              : list.data!.data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.description}</p>
                    <p className="text-xs text-ink-soft">{c.number} · {REASON[c.reason]}{c.product ? ` · ${c.quantity} × ${c.product.name}` : ""}{c.incident_on ? ` · ${formatDate(c.incident_on)}` : ""}</p>
                    {c.decision_note && <p className="text-xs text-ink-soft">Note: {c.decision_note}</p>}
                  </td>
                  <td className="px-4 py-3">{c.employee?.name}<span className="block text-xs text-ink-soft">{c.employee?.staff_no}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKobo(c.amount)}<span className="block text-xs text-ink-soft">over {c.installments} month{c.installments === 1 ? "" : "s"}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKobo(c.recovered)}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[c.status]}>{LABEL[c.status]}</Badge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.can("staff-charges.approve") && c.status === "pending" && (
                      <>
                        <Button size="sm" busy={act.isPending} onClick={() => act.mutate({ id: c.id, path: "approve" })}>Approve</Button>{" "}
                        <Button size="sm" variant="danger" onClick={() => ask(c.id, "reject", "Why is this charge rejected?")}>Reject</Button>
                      </>
                    )}
                    {s.can("staff-charges.approve") && c.status === "approved" && (
                      <Button size="sm" variant="secondary" onClick={() => ask(c.id, "waive", "Why is the rest being waived?")}>Waive charge</Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && <ChargeModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ChargeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const employees = useOptions("/employees");
  const products = useOptions("/products");
  const [f, setF] = useState({ employee_id: "", reason: "damage", description: "", product_id: "", quantity: "", unit: "", total: "", installments: "1", incident_on: new Date().toISOString().slice(0, 10) });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const byProduct = f.product_id !== "";
  const total = byProduct ? Number(f.quantity || 0) * nairaToKobo(f.unit) : nairaToKobo(f.total);

  const save = useMutation({
    mutationFn: () => api("/staff-charges", {
      method: "POST",
      body: {
        employee_id: Number(f.employee_id), reason: f.reason, description: f.description, installments: Number(f.installments) || 1, incident_on: f.incident_on || null,
        ...(byProduct ? { product_id: Number(f.product_id), quantity: Number(f.quantity), unit_amount: nairaToKobo(f.unit) } : { amount: nairaToKobo(f.total) }),
      },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-charges"] }); onClose(); },
  });

  return (
    <Modal title="Charge an employee" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Employee" value={f.employee_id} onChange={set("employee_id")} options={[{ value: "", label: "Choose an employee" }, ...employees]} required />
        <SelectField label="Reason" value={f.reason} onChange={set("reason")} options={Object.entries(REASON).map(([value, label]) => ({ value, label }))} />
        <Field label="What happened" value={f.description} onChange={(e) => set("description")(e.target.value)} placeholder="e.g. Dropped a crate while offloading" required />
        <SelectField label="Product (if a product was damaged)" value={f.product_id} onChange={set("product_id")} options={[{ value: "", label: "Not about a product" }, ...products]} />
        {byProduct ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" inputMode="numeric" value={f.quantity} onChange={(e) => set("quantity")(e.target.value.replace(/\D/g, ""))} required />
            <MoneyField label="Charge per unit" value={f.unit} onChange={set("unit")} required />
          </div>
        ) : <MoneyField label="Amount to recover" value={f.total} onChange={set("total")} required />}
        {total > 0 && <p className="text-sm">Total to recover: <strong>{formatKobo(total)}</strong></p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Spread over (months)" inputMode="numeric" value={f.installments} onChange={(e) => set("installments")(e.target.value.replace(/\D/g, ""))} hint="1 = all from the next salary." />
          <Field label="Date it happened" type="date" value={f.incident_on} onChange={(e) => set("incident_on")(e.target.value)} />
        </div>
        <p className="text-xs text-ink-soft">This recovers the money from the employee. Record the damaged stock itself under Stock → Adjustments → Damage write-off.</p>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!f.employee_id || total <= 0}>Raise charge</Button>
        </div>
      </form>
    </Modal>
  );
}
