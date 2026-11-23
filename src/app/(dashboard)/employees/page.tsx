"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DeleteButton } from "../../../components/delete-button";
import { Badge, Button, ErrorNote, Field, Modal, MoneyField, PageHeader, SearchBox, SelectField, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatKobo, koboToInput, nairaToKobo } from "../../../lib/format";
import type { Employee, PayItem, Paginated, StaffGrade } from "../../../lib/types";

export default function EmployeesPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const manage = s.can("employees.manage");

  const list = useQuery({
    queryKey: ["employees", search, status],
    queryFn: () => api<Paginated<Employee>>(`/employees?per_page=200&status=${status}&search=${encodeURIComponent(search)}`),
  });
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone on the payroll. Salary, bank details and the allowances and deductions that apply to each person."
        action={manage && <Button onClick={() => setEditing("new")}>Add employee</Button>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by name or staff number" />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="active">Current employees</option><option value="left">Former employees</option><option value="archived">Archived</option>
        </select>
      </div>
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Employee</th><th className={th}>Branch</th><th className={th}>Role</th><th className={`${th} text-right`}>Monthly basic</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.isLoading ? <TableLoading cols={5} /> : list.error ? <TableError cols={5} message={(list.error as Error).message} />
              : (list.data?.data.length ?? 0) === 0 ? <TableEmpty cols={5} title="No employees" hint="Add your staff so they can be paid and charged for damages." />
              : list.data!.data.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3"><p className="font-medium">{e.name} {e.user && <Badge tone="good">Has login</Badge>} {e.status === "left" && <Badge>Former employee</Badge>}{e.status === "archived" && <Badge>Archived</Badge>}</p><p className="text-xs text-ink-soft">{e.staff_no}{e.phone ? ` · ${e.phone}` : ""}{e.user?.email ? ` · ${e.user.email}` : ""}{e.grade ? ` · ${e.grade.name}` : ""}</p></td>
                  <td className="px-4 py-3">{(e.branches?.length ? e.branches.map((b) => b.name) : [e.branch?.name ?? "–"]).join(", ")}</td>
                  <td className="px-4 py-3">{[e.job_title, e.department].filter(Boolean).join(" · ") || "–"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatKobo(e.basic_salary)}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap items-start justify-end gap-2">{manage && <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>Edit</Button>}{manage && <ArchiveButton employee={e} />}{manage && <DeleteButton size="sm" path={`/employees/${e.id}`} noun="employee" onDone={() => qc.invalidateQueries({ queryKey: ["employees"] })} />}</div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <EmployeeModal employee={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ArchiveButton({ employee }: { employee: Employee }) {
  const qc = useQueryClient();
  const archived = employee.status === "archived";
  const m = useMutation({
    mutationFn: () => api(`/employees/${employee.id}/${archived ? "unarchive" : "archive"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  return (
    <Button size="sm" variant="secondary" busy={m.isPending}
      onClick={() => { if (archived || window.confirm(`Archive ${employee.name}? They will leave the list and future payroll runs, and all their records are kept. You can restore them later.`)) m.mutate(); }}>
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}

type ItemState = Record<number, { on: boolean; value: string }>;

/** Emails the linked login a link to set a new password (same as on the Users page). */
function SendResetButton({ userId, email }: { userId: number; email: string }) {
  const send = useMutation({ mutationFn: () => api<{ message: string }>(`/users/${userId}/send-reset`, { method: "POST" }) });

  return (
    <div>
      <Button type="button" size="sm" variant="secondary" busy={send.isPending}
        onClick={() => { if (window.confirm(`Email ${email} a link to set a new password?`)) send.mutate(); }}>
        Send reset email
      </Button>
      {send.isSuccess && <p className="mt-1 text-xs text-emerald-700">Reset email sent to {email}.</p>}
      {send.error && <p className="mt-1 text-xs text-[#c23a3a]">{(send.error as Error).message}</p>}
    </div>
  );
}

function EmployeeModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const gradesQ = useQuery({ queryKey: ["staff-grades"], queryFn: () => api<{ data: StaffGrade[] }>("/staff-grades") });
  const grades = (gradesQ.data?.data ?? []).filter((g) => g.is_active || g.id === employee?.grade_id);
  const session = useSession();
  const [loginEmail, setLoginEmail] = useState(employee?.user?.email ?? "");
  const [loginPassword, setLoginPassword] = useState("");
  const qc = useQueryClient();
  const branches = useOptions("/branches");
  const users = useOptions("/users");
  const items = useQuery({ queryKey: ["pay-items"], queryFn: () => api<{ data: PayItem[] }>("/pay-items") });
  const detail = useQuery({ queryKey: ["employee", employee?.id], enabled: !!employee, queryFn: () => api<Employee>(`/employees/${employee!.id}`) });

  const [f, setF] = useState({
    name: employee?.name ?? "", phone: employee?.phone ?? "", job_title: employee?.job_title ?? "",
    department: employee?.department ?? "", hired_on: employee?.hired_on ?? "", basic: koboToInput(employee?.basic_salary ?? 0), overtime: employee?.overtime_rate ? koboToInput(employee.overtime_rate) : "", grade_id: String(employee?.grade_id ?? ""),
    bank_name: employee?.bank_name ?? "", account_number: employee?.account_number ?? "", account_name: employee?.account_name ?? "", status: employee?.status ?? "active", user_id: String(employee?.user_id ?? ""),
  });
  const [branchIds, setBranchIds] = useState<number[]>(employee?.branches?.length ? employee.branches.map((b) => b.id) : employee?.branch_id ? [employee.branch_id] : []);
  const [picked, setPicked] = useState<ItemState | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const available = (items.data?.data ?? []).filter((i) => i.is_active && !i.apply_to_all);
  const everyone = (items.data?.data ?? []).filter((i) => i.is_active && i.apply_to_all);

  // Start from what the employee already has, until the user changes something.
  const state: ItemState = picked ?? Object.fromEntries((detail.data?.pay_items ?? []).map((p) => [p.pay_item_id, {
    on: true,
    value: p.value === null ? "" : String(p.value / 100),
  }]));

  // Login details can be changed here when the employee keeps the login they already had.
  const showLogin = !!employee?.user && String(employee.user_id ?? "") === f.user_id && session.can("users.update");

  const save = useMutation({
    mutationFn: () => {
      const pay_items = Object.entries(state).filter(([, v]) => v.on).map(([id, v]) => {
        return { pay_item_id: Number(id), value: v.value === "" ? null : Math.round(Number(v.value.replace(/,/g, "")) * 100) };
      });
      const body = {
        user_id: f.user_id ? Number(f.user_id) : null, name: f.name, branch_id: branchIds[0] ?? null, branch_ids: branchIds, phone: f.phone || null, job_title: f.job_title || null, department: f.department || null,
        hired_on: f.hired_on || null, basic_salary: nairaToKobo(f.basic), overtime_rate: f.overtime ? nairaToKobo(f.overtime) : null, grade_id: f.grade_id ? Number(f.grade_id) : null, bank_name: f.bank_name || null, account_number: f.account_number || null,
        account_name: f.account_name || null, status: f.status, pay_items,
        ...(showLogin && loginEmail.trim() && loginEmail.trim().toLowerCase() !== (employee?.user?.email ?? "").toLowerCase() ? { login_email: loginEmail.trim() } : {}),
        ...(showLogin && loginPassword ? { login_password: loginPassword } : {}),
      };
      return api(employee ? `/employees/${employee.id}` : "/employees", { method: employee ? "PUT" : "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["employee"] }); onClose(); },
  });

  const toggle = (id: number, on: boolean) => setPicked({ ...state, [id]: { on, value: state[id]?.value ?? "" } });

  return (
    <Modal title={employee ? `Edit ${employee.name}` : "Add employee"} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={f.name} onChange={(e) => set("name")(e.target.value)} required autoFocus />
          <SelectField label="Login account" value={f.user_id} onChange={set("user_id")} options={[{ value: "", label: "No login" }, ...users]} hint="Link a van salesman, driver or cashier so their pay and charges sit on one record." />
          <Field label="Job title" value={f.job_title} onChange={(e) => set("job_title")(e.target.value)} />
          <Field label="Department" value={f.department} onChange={(e) => set("department")(e.target.value)} />
          <Field label="Phone" value={f.phone} onChange={(e) => set("phone")(e.target.value)} />
          <Field label="Start date" type="date" value={f.hired_on} onChange={(e) => set("hired_on")(e.target.value)} />
          <MoneyField label="Monthly basic salary" value={f.basic} onChange={set("basic")} required />
          <SelectField label="Staff grade" value={f.grade_id} onChange={set("grade_id")}
            options={[{ value: "", label: grades.length ? "Choose a grade" : "No grades yet (add them under Staff grades)" }, ...grades.map((g) => ({ value: String(g.id), label: `${g.name}${g.overtime_rate ? ` · overtime ${formatKobo(g.overtime_rate)}/${g.overtime_basis}` : ""}` }))]}
            hint="Sets their overtime rate and Sunday pay." />
          <MoneyField label="Own overtime rate (optional)" value={f.overtime} onChange={set("overtime")} hint="Only if this person is paid differently from their grade. Leave empty to use the grade's rate." />
          {employee && <SelectField label="Status" value={f.status} onChange={set("status")} options={[{ value: "active", label: "Current employee" }, { value: "left", label: "Former employee" }]} />}
        </div>

        {showLogin && employee?.user && (
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Login</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Login email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required hint="What they sign in with." />
              <Field label="New password (optional)" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="new-password"
                hint="At least 8 characters. Leave empty to keep their current password." />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <SendResetButton userId={employee.user.id} email={employee.user.email} />
              <span className="text-xs text-ink-soft">Or email them a link to choose their own password.</span>
            </div>
          </fieldset>
        )}

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Branches</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {branches.map((b) => {
              const id = Number(b.value);
              return (
                <label key={id} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={branchIds.includes(id)}
                    onChange={(e) => setBranchIds((cur) => (e.target.checked ? [...cur, id] : cur.filter((x) => x !== id)))} />
                  {b.label}{branchIds[0] === id && branchIds.length > 1 && <span className="text-xs text-ink-soft">(main)</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-ink-soft">Tick every branch this person works in. The first one ticked is their main branch, and payroll uses it.</p>
        </fieldset>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Bank details</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Bank" value={f.bank_name} onChange={(e) => set("bank_name")(e.target.value)} />
            <Field label="Account number" value={f.account_number} onChange={(e) => set("account_number")(e.target.value)} inputMode="numeric" />
            <Field label="Account name" value={f.account_name} onChange={(e) => set("account_name")(e.target.value)} />
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Allowances and deductions for this person</legend>
          {everyone.length > 0 && <p className="mb-2 text-xs text-ink-soft">Applied to everyone automatically: {everyone.map((i) => i.name).join(", ")}.</p>}
          {available.length === 0 ? <p className="text-sm text-ink-soft">No other pay items yet. Create them under Payroll → Pay items.</p> : (
            <ul className="space-y-2">
              {available.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!state[i.id]?.on} onChange={(e) => toggle(i.id, e.target.checked)} className="size-4" />
                    {i.name} <Badge tone={i.kind === "earning" ? "good" : "warn"}>{i.kind === "earning" ? "Adds" : "Deducts"}</Badge>
                  </label>
                  {state[i.id]?.on && (
                    <input aria-label={`${i.name} amount for this person`} placeholder={`Default ${i.calc === "percent_of_basic" ? `${i.value / 100}%` : formatKobo(i.value)}`}
                      value={state[i.id].value} onChange={(e) => setPicked({ ...state, [i.id]: { on: true, value: e.target.value.replace(/[^0-9.]/g, "") } })}
                      className="min-h-10 w-40 rounded-lg border border-line px-3 text-sm" inputMode="decimal" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={branchIds.length === 0}>{employee ? "Save changes" : "Add employee"}</Button>
        </div>
      </form>
    </Modal>
  );
}
