"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, TableEmpty, TableError, TableLoading } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatKobo, koboToInput, nairaToKobo } from "../../../../lib/format";
import type { PayItem } from "../../../../lib/types";

const describe = (i: PayItem) => (i.calc === "percent_of_basic" ? `${i.value / 100}% of basic` : formatKobo(i.value));

export default function PayItemsPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PayItem | "new" | null>(null);
  const manage = s.can("payroll.manage");
  const items = useQuery({ queryKey: ["pay-items"], queryFn: () => api<{ data: PayItem[] }>("/pay-items") });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/pay-items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-items"] }),
  });
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader
        title="Pay items"
        crumb={<Link href="/payroll" className="text-[#f40009] hover:underline">← Payroll</Link>}
        description="The allowances and deductions you pay. Nothing is built in: add what applies to your business, such as transport allowance, pension or tax."
        action={manage && <Button onClick={() => setEditing("new")}>Add pay item</Button>}
      />
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Name</th><th className={th}>Type</th><th className={th}>Amount</th><th className={th}>Applies to</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.isLoading ? <TableLoading cols={5} /> : items.error ? <TableError cols={5} message={(items.error as Error).message} />
              : (items.data?.data.length ?? 0) === 0 ? <TableEmpty cols={5} title="No pay items yet" hint="Without any, payroll pays just each person's basic salary." />
              : items.data!.data.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium">{i.name} {!i.is_active && <Badge>Off</Badge>}</td>
                  <td className="px-4 py-3"><Badge tone={i.kind === "earning" ? "good" : "warn"}>{i.kind === "earning" ? "Allowance" : "Deduction"}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{describe(i)}</td>
                  <td className="px-4 py-3">{i.apply_to_all ? "Every employee" : "Chosen employees"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {manage && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(i)}>Edit</Button>{" "}
                        <Button size="sm" variant="danger" onClick={() => { if (window.confirm(`Remove ${i.name}? If it has been used on a payslip it is switched off instead.`)) remove.mutate(i.id); }}>Remove</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && <ItemModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ItemModal({ item, onClose }: { item: PayItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState(item?.kind ?? "earning");
  const [calc, setCalc] = useState(item?.calc ?? "fixed");
  const [value, setValue] = useState(item ? koboToInput(item.value) : "");
  const [all, setAll] = useState(item?.apply_to_all ?? false);
  const [active, setActive] = useState(item?.is_active ?? true);

  const save = useMutation({
    mutationFn: () => api(item ? `/pay-items/${item.id}` : "/pay-items", {
      method: item ? "PUT" : "POST",
      body: { name, kind, calc, value: Math.round(Number(value.replace(/,/g, "") || "0") * 100), apply_to_all: all, is_active: active },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pay-items"] }); onClose(); },
  });

  return (
    <Modal title={item ? `Edit ${item.name}` : "Add pay item"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Transport allowance" required autoFocus />
        <SelectField label="Type" value={kind} onChange={(v) => setKind(v as PayItem["kind"])} options={[{ value: "earning", label: "Allowance (adds to pay)" }, { value: "deduction", label: "Deduction (takes from pay)" }]} />
        <SelectField label="Worked out as" value={calc} onChange={(v) => setCalc(v as PayItem["calc"])} options={[{ value: "fixed", label: "A fixed amount each month" }, { value: "percent_of_basic", label: "A percentage of basic salary" }]} />
        {calc === "fixed"
          ? <MoneyField label="Amount per month" value={value} onChange={setValue} required />
          : <Field label="Percentage of basic" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 8" hint="Enter 8 for 8%." required />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-4" /> Apply to every employee automatically</label>
        {item && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Active</label>}
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!name || !value}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
