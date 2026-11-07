"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { WhatsAppButton } from "../../../../components/whatsapp-button";
import { payslipMessage } from "../../../../lib/share";
import { Badge, Button, Card, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, Stat } from "../../../../components/ui";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDateTime, formatKobo, nairaToKobo } from "../../../../lib/format";
import type { Payslip, PayrollRun } from "../../../../lib/types";
import { RUN_LABEL, RUN_TONE, monthLabel } from "../../../../lib/payroll";

function RunPage() {
  const id = useIdParam();
  const s = useSession();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<Payslip | null>(null);
  const [paying, setPaying] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const run = useQuery({ queryKey: ["payroll-run", id], enabled: !!id, queryFn: () => api<PayrollRun>(`/payroll-runs/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["payroll-run", id] }); qc.invalidateQueries({ queryKey: ["payroll-runs"] }); qc.invalidateQueries({ queryKey: ["staff-charges"] }); };
  const act = useMutation({ mutationFn: (path: string) => api(`/payroll-runs/${id}/${path}`, { method: "POST" }), onSuccess: refresh });
  const removeLine = useMutation({ mutationFn: (lineId: number) => api(`/payslip-lines/${lineId}`, { method: "DELETE" }), onSuccess: refresh });
  const voidRun = useMutation({ mutationFn: (reason: string) => api(`/payroll-runs/${id}/void`, { method: "POST", body: { reason } }), onSuccess: refresh });

  const r = run.data;
  if (!r) return <p className="p-6 text-sm text-ink-soft">{run.error ? (run.error as Error).message : "Loading…"}</p>;

  const draft = r.status === "draft";
  const err = act.error ?? removeLine.error ?? voidRun.error;

  return (
    <>
      <PageHeader
        title={`Payroll for ${monthLabel(r.period)}`}
        crumb={<Link href="/payroll" className="text-[#f40009] hover:underline">← Payroll</Link>}
        description={`${r.number}${r.approved_at ? ` · approved ${formatDateTime(r.approved_at)}` : ""}${r.paid_at ? ` · paid by ${r.pay_method} ${formatDateTime(r.paid_at)}` : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Badge>
            {(r.payslips ?? []).length > 0 && <Link href={`/payroll/schedule?id=${r.id}`}><Button variant="secondary">Salary schedule</Button></Link>}
            {(r.payslips ?? []).length > 0 && <Link href={`/payroll/payslip?id=${r.id}&slip=all`}><Button variant="secondary">Print all payslips</Button></Link>}
            {draft && s.can("payroll.manage") && <Button variant="secondary" busy={act.isPending} onClick={() => act.mutate("recalculate")}>Recalculate</Button>}
            {draft && s.can("payroll.approve") && <Button busy={act.isPending} onClick={() => { if (window.confirm("Approve this run? Salaries are booked and staff charges are recovered.")) act.mutate("approve"); }}>Approve run</Button>}
            {r.status === "approved" && s.can("payroll.pay") && <Button onClick={() => setPaying(true)}>Mark as paid</Button>}
            {(draft || r.status === "approved") && s.can("payroll.approve") && (
              <Button variant="danger" onClick={() => { const reason = window.prompt("Why is this run being cancelled?"); if (reason) voidRun.mutate(reason); }}>Cancel run</Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Gross pay" value={formatKobo(r.total_gross)} />
        <Stat label="Deductions" value={formatKobo(r.total_deductions)} tone="amber" />
        <Stat label="Net pay" value={formatKobo(r.total_net)} note={`${r.payslips?.length ?? 0} payslips`} />
      </div>
      {err && <div className="mb-3"><ErrorNote>{(err as Error).message}</ErrorNote></div>}
      {r.status === "void" && <div className="mb-3"><ErrorNote>This run was cancelled: {r.void_reason}</ErrorNote></div>}

      <div className="space-y-2">
        {(r.payslips ?? []).map((p) => (
          <Card key={p.id}>
            <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
              <span><span className="font-medium">{p.employee.name}</span> <span className="text-xs text-ink-soft">{p.employee.staff_no}{p.employee.job_title ? ` · ${p.employee.job_title}` : ""}</span></span>
              <span className="text-sm tabular-nums">Gross {formatKobo(p.gross)} · <span className="font-semibold">Net {formatKobo(p.net)}</span></span>
            </button>
            {open === p.id && (
              <div className="mt-3 border-t border-line pt-3">
                <table className="w-full text-sm">
                  <tbody>
                    {p.lines.map((l) => (
                      <tr key={l.id} className="border-b border-line/60 last:border-0">
                        <td className="py-1.5">{l.label}{l.source === "staff_charge" && <Badge tone="warn">Staff charge</Badge>}</td>
                        <td className={`py-1.5 text-right tabular-nums ${l.kind === "deduction" ? "text-[#c23a3a]" : ""}`}>{l.kind === "deduction" ? "−" : ""}{formatKobo(l.amount)}</td>
                        <td className="w-16 py-1.5 text-right">{draft && l.source === "manual" && <button type="button" onClick={() => removeLine.mutate(l.id)} className="text-xs font-semibold text-[#c23a3a] hover:underline">Remove</button>}</td>
                      </tr>
                    ))}
                    <tr><td className="pt-2 font-semibold">Net pay</td><td className="pt-2 text-right font-semibold tabular-nums">{formatKobo(p.net)}</td><td /></tr>
                  </tbody>
                </table>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                  <span>{p.employee.bank_name ? `${p.employee.bank_name} · ${p.employee.account_number ?? ""} · ${p.employee.account_name ?? ""}` : "No bank details on file"}</span>
                  <span className="flex flex-wrap gap-2"><Link href={`/payroll/payslip?id=${r.id}&slip=${p.id}`}><Button size="sm" variant="secondary">Print payslip</Button></Link><WhatsAppButton size="sm" phone={p.employee.phone} text={payslipMessage(p, r, s.store?.name ?? "")} label="WhatsApp" />{draft && s.can("payroll.manage") && <Button size="sm" variant="secondary" onClick={() => setAdding(p)}>Add bonus or deduction</Button>}</span>
                </div>
              </div>
            )}
          </Card>
        ))}
        {(r.payslips ?? []).length === 0 && <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-soft">No active employees fall in this run.</p>}
      </div>

      {adding && <LineModal slip={adding} onClose={() => setAdding(null)} onDone={refresh} />}
      {paying && <PayModal id={id} total={r.total_net} onClose={() => setPaying(false)} onDone={refresh} />}
    </>
  );
}

function LineModal({ slip, onClose, onDone }: { slip: Payslip; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState("earning");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const save = useMutation({
    mutationFn: () => api(`/payslips/${slip.id}/lines`, { method: "POST", body: { kind, label, amount: nairaToKobo(amount) } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title={`One-off for ${slip.employee.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Type" value={kind} onChange={setKind} options={[{ value: "earning", label: "Bonus / overtime (adds)" }, { value: "deduction", label: "Deduction (takes away)" }]} />
        <Field label="Description" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Overtime, Absent 2 days" required autoFocus />
        <MoneyField label="Amount" value={amount} onChange={setAmount} required />
        <p className="text-xs text-ink-soft">For this month only. Use Pay items for amounts that repeat every month.</p>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!label || nairaToKobo(amount) <= 0}>Add</Button>
        </div>
      </form>
    </Modal>
  );
}

function PayModal({ id, total, onClose, onDone }: { id: string; total: number; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState("bank");
  const pay = useMutation({
    mutationFn: () => api(`/payroll-runs/${id}/pay`, { method: "POST", body: { method } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title="Mark salaries as paid" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }} className="space-y-4">
        <p className="text-sm">You are paying out <strong>{formatKobo(total)}</strong> in net salaries.</p>
        <SelectField label="Paid from" value={method} onChange={setMethod} options={[{ value: "bank", label: "Bank" }, { value: "cash", label: "Cash on hand" }]} />
        {pay.error && <ErrorNote>{(pay.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={pay.isPending}>Confirm payment</Button>
        </div>
      </form>
    </Modal>
  );
}

export default withSuspense(RunPage);
