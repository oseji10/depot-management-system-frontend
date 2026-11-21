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
type Totals = Partial<Record<keyof typeof LABEL, { hours: number; sundays?: number; amount: number; count: number }>>;
const hrs = (n: number) => `${Number(n.toFixed(2))} hr${n === 1 ? "" : "s"}`;
const qtyLabel = (r: OvertimeEntry) => (r.kind === "sunday" ? "1 day" : r.basis === "day" ? `${Number(r.hours)} day${Number(r.hours) === 1 ? "" : "s"}` : hrs(Number(r.hours)));
const isSunday = (d: string) => !!d && new Date(`${d}T12:00:00`).getDay() === 0;
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
  const [editing, setEditing] = useState<OvertimeEntry | "overtime" | "sunday" | null>(null);
  const [kind, setKind] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const canManage = s.can("employees.manage");
  const canApprove = s.can("payroll.approve");

  const employees = useQuery({ queryKey: ["employees-all"], queryFn: async () => (await api<Paginated<Employee>>("/employees?per_page=100")).data });
  const qs = new URLSearchParams({ per_page: "100", ...(status && { status }), ...(kind && { kind }), ...(employee && { employee_id: employee }), ...(from && { from }), ...(to && { to }) });
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
        title="Overtime & Sunday work"
        description="Record overtime and Sunday work. Rates come from each person's staff grade. Once approved, they are paid on the next payroll run."
        action={canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing("sunday")}>Record Sunday work</Button>
            <Button onClick={() => setEditing("overtime")}>Record overtime</Button>
          </div>
        )}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(["pending", "approved", "paid"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setStatus(status === k ? "" : k)}
            className={`rounded-2xl border bg-surface p-4 text-left shadow-sm transition ${status === k ? "border-[#f40009]" : "border-line hover:border-ink-soft/40"}`}>
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{LABEL[k]}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatKobo(t[k]?.amount ?? 0)}</p>
            <p className="text-sm text-ink-soft">{t[k]?.count ?? 0} entr{(t[k]?.count ?? 0) === 1 ? "y" : "ies"}{(t[k]?.sundays ?? 0) > 0 ? ` · ${t[k]?.sundays} Sunday${t[k]?.sundays === 1 ? "" : "s"}` : ""}</p>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">Any status</option>
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">Overtime and Sunday work</option>
          <option value="overtime">Overtime only</option>
          <option value="sunday">Sunday work only</option>
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
              {canApprove && (
                <th className="w-10 py-3.5 pl-4">
                  {pending.length > 0 && (
                    <input type="checkbox" aria-label="Select all waiting entries" className="size-4 accent-[#f40009]"
                      checked={pending.every((r) => picked.includes(r.id))}
                      ref={(el) => { if (el) el.indeterminate = picked.length > 0 && !pending.every((r) => picked.includes(r.id)); }}
                      onChange={() => setPicked(pending.every((r) => picked.includes(r.id)) ? [] : pending.map((r) => r.id))} />
                  )}
                </th>
              )}
              <th className={th}>Employee</th><th className={th}>Date</th><th className={th}>Type</th><th className={`${th} text-right`}>Quantity</th><th className={`${th} text-right`}>Rate</th>
              <th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.isLoading ? <TableLoading cols={9} /> : list.error ? <TableError cols={9} message={(list.error as Error).message} />
              : rows.length === 0 ? <TableEmpty cols={9} title="No overtime in this period" hint="Record the extra hours someone worked, then approve them before the payroll run." />
              : rows.map((r) => (
                <tr key={r.id} className="align-top">
                  {canApprove && (
                    <td className="w-10 py-3 pl-4">
                      {r.status === "pending" && <input type="checkbox" aria-label={`Select ${r.employee?.name}`} checked={picked.includes(r.id)} onChange={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])} />}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.employee?.name}</p>
                    <p className="text-xs text-ink-soft">{r.employee?.staff_no}{r.employee?.grade ? ` · ${r.employee.grade.name}` : ""}{r.creator ? ` · recorded by ${r.creator.name}` : ""}</p>
                    {r.note && <p className="text-xs italic text-ink-soft">“{r.note}”</p>}
                    {r.decision_note && <p className="text-xs text-ink-soft">Note: {r.decision_note}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.worked_on)}</td>
                  <td className="px-4 py-3">{r.kind === "sunday" ? <Badge tone="warn">Sunday work</Badge> : <Badge tone="neutral">Overtime</Badge>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{qtyLabel(r)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKobo(r.rate)}<span className="block text-xs text-ink-soft">per {r.kind === "sunday" || r.basis === "day" ? "day" : "hour"}</span></td>
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

      {editing && <OvertimeModal entry={typeof editing === "string" ? null : editing} kind={typeof editing === "string" ? editing : editing.kind ?? "overtime"} employees={employees.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
    </>
  );
}

function OvertimeModal({ entry, kind, employees, onClose, onSaved }: { entry: OvertimeEntry | null; kind: "overtime" | "sunday"; employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const sunday = kind === "sunday";
  const lastSunday = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); };
  const [f, setF] = useState({
    employee_id: String(entry?.employee_id ?? ""), worked_on: entry?.worked_on ?? (sunday ? lastSunday() : today()),
    qty: entry && !sunday ? String(Number(entry.hours)) : "", rate: entry && !sunday && entry.rate ? koboToInput(entry.rate) : "", note: entry?.note ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const person = employees.find((e) => String(e.id) === f.employee_id);
  const grade = person?.grade ?? null;

  // What the server will use: a typed rate, else the person's own rate, else their grade's rate and basis.
  const ownRate = person?.overtime_rate ?? 0;
  const basis: "hour" | "day" = f.rate || ownRate ? "hour" : grade?.overtime_basis ?? "hour";
  const rate = f.rate ? nairaToKobo(f.rate) : ownRate || grade?.overtime_rate || 0;
  // A per-day rate pays one day for the date worked; a per-hour rate needs the hours.
  const qty = basis === "day" ? 1 : Number(f.qty) || 0;
  const sundayPay = person ? Math.round(person.basic_salary / (grade?.sunday_divisor || 30)) : 0;
  const pay = sunday ? sundayPay : Math.round(qty * rate);

  const save = useMutation({
    mutationFn: () => {
      const body = sunday
        ? { kind: "sunday", employee_id: Number(f.employee_id), worked_on: f.worked_on, note: f.note || null }
        : { kind: "overtime", employee_id: Number(f.employee_id), worked_on: f.worked_on, hours: qty, basis, rate: f.rate ? nairaToKobo(f.rate) : null, note: f.note || null };
      return entry ? api(`/overtime/${entry.id}`, { method: "PUT", body }) : api("/overtime", { method: "POST", body });
    },
    onSuccess: onSaved,
  });

  const badDay = sunday && !isSunday(f.worked_on);
  const ready = !!f.employee_id && !badDay && pay > 0;

  return (
    <Modal title={sunday ? (entry ? "Edit Sunday work" : "Record Sunday work") : (entry ? "Edit overtime" : "Record overtime")} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Employee" value={f.employee_id} onChange={set("employee_id")} required
          options={[{ value: "", label: "Choose an employee" }, ...employees.filter((e) => e.status === "active").map((e) => ({ value: String(e.id), label: `${e.name}${e.grade ? ` · ${e.grade.name}` : ""}` }))]} />
        {sunday ? (
          <>
            <Field label="Sunday worked" type="date" value={f.worked_on} max={today()} onChange={(e) => set("worked_on")(e.target.value)} required
              error={badDay ? "Pick a Sunday." : undefined} />
            {person && (
              <p className="rounded-xl bg-paper px-3 py-2 text-sm">
                One day&apos;s pay: {formatKobo(person.basic_salary)} basic ÷ {grade?.sunday_divisor || 30} = <strong>{formatKobo(sundayPay)}</strong>
                {!grade && <span className="block text-xs text-ink-soft">No staff grade, so the standard 30 is used.</span>}
              </p>
            )}
          </>
        ) : (
          <>
            <div className={basis === "hour" ? "grid grid-cols-2 gap-3" : ""}>
              <Field label="Date worked" type="date" value={f.worked_on} max={today()} onChange={(e) => set("worked_on")(e.target.value)} required />
              {basis === "hour" && (
                <Field label="Hours" inputMode="decimal" value={f.qty} onChange={(e) => set("qty")(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 3 or 2.5" required />
              )}
            </div>
            <MoneyField label="Rate (optional)" value={f.rate} onChange={set("rate")}
              hint={person ? (ownRate ? `${person.name} has their own rate of ${formatKobo(ownRate)} per hour.` : grade?.overtime_rate ? `${grade.name}: ${formatKobo(grade.overtime_rate)} per ${grade.overtime_basis}. Leave empty to use it.` : "No grade rate set: type a rate, or set one under Staff grades.") : "Choose an employee first."} />
          </>
        )}
        <Field label="Note (optional)" value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder={sunday ? "e.g. Sunday offloading" : "e.g. Offloading late delivery"} />
        {pay > 0 && <p className="text-sm">To be paid: <strong>{formatKobo(pay)}</strong>{!sunday && <> ({basis === "day" ? `${qty} day${qty === 1 ? "" : "s"}` : hrs(qty)} × {formatKobo(rate)})</>}</p>}
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!ready}>{entry ? "Save" : "Record"}</Button>
        </div>
      </form>
    </Modal>
  );
}
