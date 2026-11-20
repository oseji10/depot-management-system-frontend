"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate, formatKobo, koboToInput, nairaToKobo } from "../../../lib/format";
import type { Employee, OvertimeEntry, Paginated } from "../../../lib/types";

const LABEL = { pending: "Waiting for approval", approved: "Approved, not yet paid", rejected: "Rejected", paid: "Paid" } as const;
const TONE = { pending: "warn", approved: "good", rejected: "bad", paid: "neutral" } as const;
type Totals = Partial<Record<keyof typeof LABEL, { hours: number; amount: number; count: number }>>;
const hrs = (n: number) => `${Number(n.toFixed(2))} hr${n === 1 ? "" : "s"}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

/** Extra hours worked. Approved hours are added to the next payroll run as an "Overtime" earning, then marked paid. */
export default function OvertimePage() {
  const s = useSession();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [employee, setEmployee] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [editing, setEditing] = useState<OvertimeEntry | "new" | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const canManage = s.can("employees.manage");
  const canApprove = s.can("payroll.approve");

  const employees = useQuery({ queryKey: ["employees-all"], queryFn: async () => (await api<Paginated<Employee>>("/employees?per_page=100")).data });
  const qs = new URLSearchParams({ per_page: "100", ...(status && { status }), ...(employee && { employee_id: employee }), ...(from && { from }), ...(to && { to }) });
  const list = useQuery({ queryKey: ["overtime", qs.toString()], queryFn: () => api<Paginated<OvertimeEntry> & { totals: Totals }>(`/overtime?${qs}`) });
  const refresh = () => { setPicked([]); return qc.invalidateQueries({ queryKey: ["overtime"] }); };

  const approve = useMutation({ mutationFn: (ids: number[]) => api("/overtime/approve", { method: "POST", body: { ids } }), onSuccess: refresh });
  const reject = useMutation({ mutationFn: ({ id, note }: { id: number; note: string }) => api(`/overtime/${id}/reject`, { method: "POST", body: { note } }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => api(`/overtime/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const error = approve.error ?? reject.error ?? remove.error;

  const rows = list.data?.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const t = list.data?.totals ?? {};
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader
        title="Overtime"
        description="Record extra hours staff worked. Once approved, they are paid on the next payroll run as an Overtime earning."
        action={canManage && <Button onClick={() => setEditing("new")}>Record overtime</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(["pending", "approved", "paid"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setStatus(status === k ? "" : k)}
            className={`rounded-2xl border bg-surface p-4 text-left shadow-sm transition ${status === k ? "border-[#f40009]" : "border-line hover:border-ink-soft/40"}`}>
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{LABEL[k]}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatKobo(t[k]?.amount ?? 0)}</p>
            <p className="text-sm text-ink-soft">{hrs(t[k]?.hours ?? 0)} · {t[k]?.count ?? 0} entr{(t[k]?.count ?? 0) === 1 ? "y" : "ies"}</p>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">Any status</option>
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Employee" value={employee} onChange={(e) => setEmployee(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">All staff</option>
          {(employees.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2">
          <input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="min-h-10 bg-transparent text-sm" />
          <span className="text-ink-soft">–</span>
          <input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="min-h-10 bg-transparent text-sm" />
        </div>
        {canApprove && pending.length > 0 && (
          <div className="ml-auto flex gap-2">
            {picked.length > 0 && <Button busy={approve.isPending} onClick={() => approve.mutate(picked)}>Approve {picked.length} selected</Button>}
            <Button variant="secondary" busy={approve.isPending} onClick={() => { if (window.confirm(`Approve all ${pending.length} waiting entries shown?`)) approve.mutate(pending.map((r) => r.id)); }}>Approve all waiting</Button>
          </div>
        )}
      </div>

      {error && <div className="mb-3"><ErrorNote>{(error as Error).message}</ErrorNote></div>}

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              {canApprove && <th className="w-10 py-3.5 pl-4"><span className="sr-only">Select</span></th>}
              <th className={th}>Employee</th><th className={th}>Date</th><th className={`${th} text-right`}>Hours</th><th className={`${th} text-right`}>Rate / hr</th>
              <th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.isLoading ? <TableLoading cols={8} /> : list.error ? <TableError cols={8} message={(list.error as Error).message} />
              : rows.length === 0 ? <TableEmpty cols={8} title="No overtime in this period" hint="Record the extra hours someone worked, then approve them before the payroll run." />
              : rows.map((r) => (
                <tr key={r.id} className="align-top">
                  {canApprove && (
                    <td className="w-10 py-3 pl-4">
                      {r.status === "pending" && <input type="checkbox" aria-label={`Select ${r.employee?.name}`} checked={picked.includes(r.id)} onChange={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])} />}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.employee?.name}</p>
                    <p className="text-xs text-ink-soft">{r.employee?.staff_no}{r.creator ? ` · recorded by ${r.creator.name}` : ""}</p>
                    {r.note && <p className="text-xs italic text-ink-soft">“{r.note}”</p>}
                    {r.decision_note && <p className="text-xs text-ink-soft">Note: {r.decision_note}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.worked_on)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(r.hours)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKobo(r.rate)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatKobo(r.amount)}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canApprove && r.status === "pending" && <Button size="sm" busy={approve.isPending} onClick={() => approve.mutate([r.id])}>Approve</Button>}{" "}
                    {canApprove && (r.status === "pending" || r.status === "approved") && (
                      <Button size="sm" variant="danger" onClick={() => { const note = window.prompt("Why is this overtime rejected? (optional)"); if (note !== null) reject.mutate({ id: r.id, note }); }}>Reject</Button>
                    )}{" "}
                    {canManage && (r.status === "pending" || r.status === "rejected") && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>{" "}
                        <button type="button" onClick={() => { if (window.confirm("Delete this overtime entry?")) remove.mutate(r.id); }} className="text-xs font-semibold text-[#c23a3a] hover:underline">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && <OvertimeModal entry={editing === "new" ? null : editing} employees={employees.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
    </>
  );
}

function OvertimeModal({ entry, employees, onClose, onSaved }: { entry: OvertimeEntry | null; employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    employee_id: String(entry?.employee_id ?? ""), worked_on: entry?.worked_on ?? today(), hours: entry ? String(Number(entry.hours)) : "",
    rate: entry ? koboToInput(entry.rate) : "", note: entry?.note ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const person = employees.find((e) => String(e.id) === f.employee_id);
  const defaultRate = person?.overtime_rate ?? 0;
  const rate = f.rate ? nairaToKobo(f.rate) : defaultRate;
  const hours = Number(f.hours) || 0;

  const save = useMutation({
    mutationFn: () => {
      const body = { employee_id: Number(f.employee_id), worked_on: f.worked_on, hours, rate: f.rate ? nairaToKobo(f.rate) : null, note: f.note || null };
      return entry ? api(`/overtime/${entry.id}`, { method: "PUT", body }) : api("/overtime", { method: "POST", body });
    },
    onSuccess: onSaved,
  });

  return (
    <Modal title={entry ? "Edit overtime" : "Record overtime"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Employee" value={f.employee_id} onChange={set("employee_id")} required
          options={[{ value: "", label: "Choose an employee" }, ...employees.filter((e) => e.status === "active").map((e) => ({ value: String(e.id), label: e.name }))]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date worked" type="date" value={f.worked_on} max={today()} onChange={(e) => set("worked_on")(e.target.value)} required />
          <Field label="Hours" inputMode="decimal" value={f.hours} onChange={(e) => set("hours")(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 3 or 2.5" required />
        </div>
        <MoneyField label="Rate per hour" value={f.rate} onChange={set("rate")}
          hint={defaultRate ? `Leave empty to use ${person?.name}'s rate of ${formatKobo(defaultRate)} per hour.` : "This person has no overtime rate set, so type one (or set it on the employee)."} />
        <Field label="Note (optional)" value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder="e.g. Offloading late delivery" />
        {hours > 0 && rate > 0 && <p className="text-sm">To be paid: <strong>{formatKobo(Math.round(hours * rate))}</strong> ({hrs(hours)} × {formatKobo(rate)})</p>}
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!f.employee_id || hours <= 0 || rate <= 0}>{entry ? "Save" : "Record"}</Button>
        </div>
      </form>
    </Modal>
  );
}
