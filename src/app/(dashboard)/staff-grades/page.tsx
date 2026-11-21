"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatKobo, koboToInput, nairaToKobo } from "../../../lib/format";
import type { StaffGrade } from "../../../lib/types";

/** Staff grades (e.g. Senior, Junior): the overtime rate of each, and how Sunday work is paid. */
export default function StaffGradesPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<StaffGrade | "new" | null>(null);
  const canManage = s.can("employees.manage");
  const list = useQuery({ queryKey: ["staff-grades"], queryFn: () => api<{ data: StaffGrade[] }>("/staff-grades") });
  const remove = useMutation({ mutationFn: (id: number) => api(`/staff-grades/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-grades"] }) });
  const rows = list.data?.data ?? [];
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader title="Staff grades"
        description="Each employee is on a grade. The grade sets their overtime rate, and Sunday work pays one day's basic salary (basic salary ÷ the divisor, 30 by default)."
        action={canManage && <Button onClick={() => setEditing("new")}>Add grade</Button>} />
      {remove.error && <div className="mb-3"><ErrorNote>{(remove.error as Error).message}</ErrorNote></div>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Grade</th><th className={th}>Overtime rate</th><th className={th}>Sunday work pays</th><th className={th}>Staff</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.isLoading ? <TableLoading cols={5} /> : list.error ? <TableError cols={5} message={(list.error as Error).message} />
              : rows.length === 0 ? <TableEmpty cols={5} title="No grades yet" hint="Add Senior staff and Junior staff with their overtime rates." />
              : rows.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-medium">{g.name}{!g.is_active && <> <Badge tone="neutral">Inactive</Badge></>}</td>
                  <td className="px-4 py-3">{g.overtime_rate > 0 ? `${formatKobo(g.overtime_rate)} per ${g.overtime_basis}` : <span className="text-ink-soft">Not set</span>}</td>
                  <td className="px-4 py-3">Basic salary ÷ {g.sunday_divisor}</td>
                  <td className="px-4 py-3">{g.employees_count ?? 0}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canManage && <Button size="sm" variant="secondary" onClick={() => setEditing(g)}>Edit</Button>}{" "}
                    {canManage && (g.employees_count ?? 0) === 0 && <button type="button" className="text-xs font-semibold text-[#c23a3a] hover:underline" onClick={() => { if (window.confirm(`Delete the grade ${g.name}?`)) remove.mutate(g.id); }}>Delete</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <GradeModal grade={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["staff-grades"] }); }} />}
    </>
  );
}

function GradeModal({ grade, onClose, onSaved }: { grade: StaffGrade | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: grade?.name ?? "", rate: grade ? koboToInput(grade.overtime_rate) : "", basis: grade?.overtime_basis ?? "day",
    divisor: String(grade?.sunday_divisor ?? 30), active: grade?.is_active ?? true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: f.name.trim(), overtime_rate: f.rate ? nairaToKobo(f.rate) : 0, overtime_basis: f.basis, sunday_divisor: Number(f.divisor) || 30, is_active: f.active };
      return grade ? api(`/staff-grades/${grade.id}`, { method: "PUT", body }) : api("/staff-grades", { method: "POST", body });
    },
    onSuccess: onSaved,
  });

  return (
    <Modal title={grade ? `Edit ${grade.name}` : "Add staff grade"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Senior staff" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Overtime rate" value={f.rate} onChange={(v) => setF({ ...f, rate: v })} hint="What one unit of overtime pays." />
          <SelectField label="Paid per" value={f.basis} onChange={(v) => setF({ ...f, basis: v as "hour" | "day" })}
            options={[{ value: "day", label: "Day of overtime" }, { value: "hour", label: "Hour of overtime" }]} />
        </div>
        <Field label="Sunday pay: basic salary divided by" inputMode="numeric" value={f.divisor} onChange={(e) => setF({ ...f, divisor: e.target.value.replace(/[^\d]/g, "") })}
          hint="A staff member who works on a Sunday is paid one day: their monthly basic salary ÷ this number (30 = a 30-day month)." required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#f40009]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Grade is in use</label>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending} disabled={!f.name.trim()}>{grade ? "Save" : "Add grade"}</Button></div>
      </form>
    </Modal>
  );
}
