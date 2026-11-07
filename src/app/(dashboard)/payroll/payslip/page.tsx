"use client";

import { useQuery } from "@tanstack/react-query";
import { WhatsAppButton } from "../../../../components/whatsapp-button";
import { payslipMessage } from "../../../../lib/share";
import { PrintSheet } from "../../../../components/print-sheet";
import { withSuspense } from "../../../../components/suspense-page";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatAmount, formatDateTime, formatKobo } from "../../../../lib/format";
import { monthLabel } from "../../../../lib/payroll";
import type { PayrollRun, Payslip } from "../../../../lib/types";

/** ?id=<run>&slip=<payslip id>, or slip=all for every payslip in the run, one per page. */
function PayslipPage() {
  const id = useIdParam();
  const { store } = useSession();
  const slipParam = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("slip") ?? "all";
  const q = useQuery({ queryKey: ["payroll-run", id], enabled: !!id, queryFn: () => api<PayrollRun>(`/payroll-runs/${id}`) });
  const r = q.data;
  const slips = (r?.payslips ?? []).filter((p) => slipParam === "all" || String(p.id) === slipParam);

  return (
    <PrintSheet back={{ href: `/payroll/view?id=${id}`, label: "Back to payroll" }} title="Payslip" subtitle={r && <>{monthLabel(r.period)}<br />{r.number}</>}>
      {!r ? <p className="text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p> : slips.map((p, i) => <Slip key={p.id} p={p} first={i === 0} store={store?.name ?? ""} paidAt={r.paid_at} method={r.pay_method} run={r} />)}
    </PrintSheet>
  );
}

function Slip({ p, first, store, paidAt, method, run }: { p: Payslip; first: boolean; store: string; paidAt: string | null; method: string | null; run: PayrollRun }) {
  const earnings = p.lines.filter((l) => l.kind === "earning");
  const deductions = p.lines.filter((l) => l.kind === "deduction");

  return (
    <section className={first ? "" : "mt-10 border-t-2 border-dashed border-line pt-6 print:mt-0 print:break-before-page print:border-0 print:pt-0"}>
      {!first && <p className="mb-2 text-base font-bold">{store} · Payslip</p>}
      <div className="mb-3 print:hidden"><WhatsAppButton size="sm" phone={p.employee.phone} text={payslipMessage(p, run, store)} label={`Send to ${p.employee.name.split(" ")[0]} on WhatsApp`} /></div>
      <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
        <div><p className="text-ink-soft">Employee</p><p className="text-sm font-semibold">{p.employee.name}</p><p className="text-ink-soft">{p.employee.staff_no}{p.employee.job_title ? ` · ${p.employee.job_title}` : ""}</p></div>
        <div className="text-right"><p className="text-ink-soft">Paid to</p><p className="text-sm font-semibold">{p.employee.bank_name ?? "No bank details"}</p><p className="text-ink-soft">{[p.employee.account_number, p.employee.account_name].filter(Boolean).join(" · ")}</p></div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <Block title="Earnings" rows={earnings} total={p.gross} totalLabel="Gross pay" />
        <Block title="Deductions" rows={deductions} total={p.charges_total + p.other_deductions} totalLabel="Total deductions" />
      </div>
      <p className="mt-4 flex justify-between rounded-xl bg-surface px-4 py-3 text-base font-bold print:bg-transparent print:px-0"><span>Net pay</span><span>{formatKobo(p.net)}</span></p>
      <p className="mt-2 text-xs text-ink-soft">{paidAt ? `Paid ${formatDateTime(paidAt)}${method ? ` by ${method}` : ""}.` : "Not yet paid."}</p>
    </section>
  );
}

function Block({ title, rows, total, totalLabel }: { title: string; rows: { id: number; label: string; amount: number }[]; total: number; totalLabel: string }) {
  return (
    <div>
      <p className="mb-1 border-b border-line pb-1 text-xs font-semibold uppercase text-ink-soft">{title}</p>
      <table className="w-full text-sm"><tbody>
        {rows.map((l) => <tr key={l.id}><td className="py-1">{l.label}</td><td className="py-1 text-right tabular-nums">{formatAmount(l.amount)}</td></tr>)}
        {rows.length === 0 && <tr><td className="py-1 text-ink-soft">None</td><td /></tr>}
        <tr className="border-t border-line font-semibold"><td className="pt-1.5">{totalLabel}</td><td className="pt-1.5 text-right tabular-nums">{formatAmount(total)}</td></tr>
      </tbody></table>
    </div>
  );
}

export default withSuspense(PayslipPage);
