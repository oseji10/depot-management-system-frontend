"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, PageHeader, SelectField, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatKobo } from "../../../lib/format";
import { RUN_LABEL, RUN_TONE, monthLabel } from "../../../lib/payroll";
import type { PayrollRun, Paginated } from "../../../lib/types";

export default function PayrollPage() {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const runs = useQuery({ queryKey: ["payroll-runs"], queryFn: () => api<Paginated<PayrollRun>>("/payroll-runs") });
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Pay your staff month by month. Each run works out every payslip, recovers staff charges and books the salaries."
        action={
          <div className="flex gap-2">
            <Link href="/payroll/items" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-[#fff5f5]">Pay items</Link>
            {s.can("payroll.manage") && <Button onClick={() => setOpen(true)}>New payroll run</Button>}
          </div>
        }
      />
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Month</th><th className={`${th} text-right`}>Gross</th><th className={`${th} text-right`}>Deductions</th><th className={`${th} text-right`}>Net pay</th><th className={th}>Status</th><th className={th}><span className="sr-only">Open</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {runs.isLoading ? <TableLoading cols={6} /> : runs.error ? <TableError cols={6} message={(runs.error as Error).message} />
              : (runs.data?.data.length ?? 0) === 0 ? <TableEmpty cols={6} title="No payroll runs yet" hint="Add your employees first, then start a run for the month." />
              : runs.data!.data.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><p className="font-medium">{monthLabel(r.period)}</p><p className="text-xs text-ink-soft">{r.number}</p></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKobo(r.total_gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKobo(r.total_deductions)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatKobo(r.total_net)}</td>
                  <td className="px-4 py-3"><Badge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-3 text-right"><Link href={`/payroll/view?id=${r.id}`} className="font-semibold text-[#f40009] hover:underline">Open</Link></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && <NewRun onClose={() => setOpen(false)} />}
    </>
  );
}

function NewRun({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const branches = useOptions("/branches");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [branch, setBranch] = useState("");

  const create = useMutation({
    mutationFn: () => api<PayrollRun>("/payroll-runs", { method: "POST", body: { period, branch_id: branch ? Number(branch) : null } }),
    onSuccess: (run) => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); router.push(`/payroll/view?id=${run.id}`); },
  });

  return (
    <Modal title="New payroll run" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Field label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
        <SelectField label="Who to pay" value={branch} onChange={setBranch} options={[{ value: "", label: "All branches" }, ...branches]} />
        <p className="text-sm text-ink-soft">The run is a draft first. You can check each payslip and add one-off bonuses or deductions before approving it.</p>
        {create.error && <ErrorNote>{(create.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={create.isPending}>Create draft</Button>
        </div>
      </form>
    </Modal>
  );
}
