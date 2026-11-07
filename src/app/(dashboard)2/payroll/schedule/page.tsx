"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { withSuspense } from "../../../../components/suspense-page";
import { Badge, Button, ErrorNote, ICON, PageHeader, SelectField, Stat, Svg, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../../components/ui";
import { api } from "../../../../lib/api";
import { formatAmount, formatKobo } from "../../../../lib/format";
import { RUN_LABEL, RUN_TONE, monthLabel } from "../../../../lib/payroll";
import { bankCsv, download, fullCsv, scheduleRows } from "../../../../lib/schedule";
import type { Paginated, PayrollRun } from "../../../../lib/types";

/** The salary schedule: who is paid what and where, ready to print or to upload to a bank or payment platform. ?id=<run> picks the run. */
function SchedulePage() {
  const fromUrl = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("id") ?? "";
  const [chosen, setChosen] = useState(fromUrl);
  const runs = useQuery({ queryKey: ["payroll-runs", "all"], queryFn: () => api<Paginated<PayrollRun>>("/payroll-runs") });
  const usable = (runs.data?.data ?? []).filter((r) => r.status !== "void");
  const id = chosen || String(usable.find((r) => r.status === "approved")?.id ?? usable[0]?.id ?? "");
  const run = useQuery({ queryKey: ["payroll-run", id], enabled: !!id, queryFn: () => api<PayrollRun>(`/payroll-runs/${id}`) });
  const r = run.data;
  const rows = scheduleRows(r?.payslips ?? []);
  const sum = (k: "basic" | "rewards" | "other_earnings" | "deductions" | "net") => rows.reduce((n, x) => n + x[k], 0);
  const missing = rows.filter((x) => !x.ready);
  const payable = rows.filter((x) => x.ready);

  return (
    <>
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } html, body { background: #fff !important; } }`}</style>
      <PageHeader
        title="Salary schedule"
        crumb={<Link href="/payroll" className="text-[#f40009] hover:underline print:hidden">← Payroll</Link>}
        description="Who is paid what, and into which account. Download it to upload to your bank or payment platform, or print it."
        action={r && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" onClick={() => download(`salary-schedule-${r.period}.csv`, fullCsv(r, rows))}>Download schedule (CSV)</Button>
            <Button onClick={() => download(`bank-upload-${r.period}.csv`, bankCsv(r, rows))} disabled={!payable.length}><Svg d={ICON.cash} /> Download bank upload file</Button>
            <Button variant="secondary" onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button>
          </div>
        )}
      />

      <div className="mb-4 max-w-sm print:hidden">
        <SelectField label="Payroll month" value={id} onChange={setChosen}
          options={usable.length ? usable.map((x) => ({ value: x.id, label: `${monthLabel(x.period)} · ${RUN_LABEL[x.status]} · ${x.number}` })) : [{ value: "", label: runs.isLoading ? "Loading…" : "No payroll runs yet" }]} />
      </div>

      {r && (
        <>
          <p className="mb-3 hidden print:block"><b>{monthLabel(r.period)}</b> · {r.number}</p>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="To be paid" value={formatKobo(sum("net"))} note={`${rows.length} staff`} />
            <Stat label="Sales rewards" value={formatKobo(sum("rewards"))} tone="green" note="Included above" />
            <Stat label="Deductions" value={formatKobo(sum("deductions"))} tone="amber" />
            <Stat label="Status" value={RUN_LABEL[r.status]} note={r.paid_at ? "Paid" : undefined} />
          </div>
          {r.status === "draft" && <div className="mb-3"><ErrorNote>This run is still a draft, so these figures can change. Approve it before sending the file to the bank.</ErrorNote></div>}
          {missing.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <b>{missing.length} {missing.length === 1 ? "person has" : "people have"} no account number</b> and {missing.length === 1 ? "is" : "are"} left out of the bank upload file: {missing.map((m) => m.name).join(", ")}. Add their bank details on the Employees page.
            </div>
          )}
        </>
      )}

      <TableCard min="60rem">
        <thead className={theadClass}>
          <tr>
            <th className={thClass}>Employee</th><th className={thClass}>Bank</th><th className={thClass}>Account</th>
            <th className={`${thClass} text-right`}>Basic</th><th className={`${thClass} text-right`}>Sales reward</th><th className={`${thClass} text-right`}>Other</th>
            <th className={`${thClass} text-right`}>Deductions</th><th className={`${thClass} text-right`}>Net pay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(runs.isLoading || run.isLoading) && <TableLoading cols={8} />}
          {run.error && <TableError cols={8} message={(run.error as Error).message} />}
          {r && rows.length === 0 && <TableEmpty cols={8} title="No payslips in this run" />}
          {rows.map((x) => (
            <tr key={x.id}>
              <td className="px-4 py-3"><p className="font-medium">{x.name}</p><p className="text-xs text-ink-soft">{x.staff_no}</p></td>
              <td className="px-4 py-3">{x.bank_name ?? <Badge tone="warn">No bank</Badge>}{x.bank_name && !x.bank_code && <span className="block text-[11px] text-ink-soft print:hidden">bank code not found</span>}</td>
              <td className="px-4 py-3"><p className="font-mono text-xs">{x.account_number ?? "–"}</p><p className="text-xs text-ink-soft">{x.account_name}</p></td>
              <td className="px-4 py-3 text-right tabular-nums">{formatAmount(x.basic)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{x.rewards ? formatAmount(x.rewards) : "–"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{x.other_earnings ? formatAmount(x.other_earnings) : "–"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{x.deductions ? `−${formatAmount(x.deductions)}` : "–"}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatAmount(x.net)}</td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="bg-paper font-semibold">
              <td className="px-4 py-3" colSpan={3}>Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatAmount(sum("basic"))}</td><td className="px-4 py-3 text-right tabular-nums">{formatAmount(sum("rewards"))}</td><td className="px-4 py-3 text-right tabular-nums">{formatAmount(sum("other_earnings"))}</td>
              <td className="px-4 py-3 text-right tabular-nums">−{formatAmount(sum("deductions"))}</td><td className="px-4 py-3 text-right tabular-nums">{formatAmount(sum("net"))}</td>
            </tr>
          )}
        </tbody>
      </TableCard>

      <p className="mt-3 text-xs text-ink-soft print:hidden">The bank upload file has one line per person: beneficiary, account number, bank code, bank name, amount, narration and a reference. Bank codes are filled in from the bank name where it is recognised; check them against your bank&apos;s template before uploading.</p>
    </>
  );
}

export default withSuspense(SchedulePage);
