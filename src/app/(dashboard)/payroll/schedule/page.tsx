"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BusinessHeader } from "../../../../components/business-header";
import { withSuspense } from "../../../../components/suspense-page";
import { Badge, Button, ErrorNote, ICON, Modal, PageHeader, SelectField, Stat, Svg, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { API_URL, authHeaders } from "../../../../lib/auth";
import { downloadBlob, logoJpeg, tablePdf } from "../../../../lib/pdf";
import { formatAmount, formatKobo } from "../../../../lib/format";
import { RUN_LABEL, RUN_TONE, monthLabel } from "../../../../lib/payroll";
import { bankCsv, download, fullCsv, scheduleRows } from "../../../../lib/schedule";
import type { Paginated, PayrollRun, Payslip, Session } from "../../../../lib/types";

type Row = ReturnType<typeof scheduleRows>[number];
type MoneyKey = "basic" | "rewards" | "other_earnings" | "deductions" | "net";
type Col = { key: string; label: string; width: number; money?: MoneyKey; cell: (x: Row) => ReactNode; text: (x: Row) => string };
const dash = (n: number, neg = false) => (n ? `${neg ? "−" : ""}${formatAmount(n)}` : "–");

/** Every column the schedule can show. Pick any of them to print or download (e.g. only name and net pay for the bank). */
const COLUMNS: Col[] = [
  { key: "employee", label: "Employee", width: 20, cell: (x) => <><p className="font-medium text-[#f40009] print:text-black">{x.name}</p><p className="text-xs text-ink-soft">{x.staff_no}</p></>, text: (x) => `${x.name} (${x.staff_no})` },
  { key: "bank", label: "Bank", width: 14, cell: (x) => <>{x.bank_name ?? <Badge tone="warn">No bank</Badge>}</>, text: (x) => x.bank_name ?? "-" },
  { key: "account", label: "Account", width: 18, cell: (x) => <><p className="font-mono text-xs">{x.account_number ?? "–"}</p><p className="text-xs text-ink-soft">{x.account_name}</p></>, text: (x) => [x.account_number, x.account_name].filter(Boolean).join(" ") || "-" },
  { key: "basic", label: "Basic", width: 10, money: "basic", cell: (x) => formatAmount(x.basic), text: (x) => formatAmount(x.basic) },
  { key: "rewards", label: "Sales reward", width: 10, money: "rewards", cell: (x) => dash(x.rewards), text: (x) => (x.rewards ? formatAmount(x.rewards) : "-") },
  { key: "other", label: "Other", width: 9, money: "other_earnings", cell: (x) => dash(x.other_earnings), text: (x) => (x.other_earnings ? formatAmount(x.other_earnings) : "-") },
  { key: "deductions", label: "Deductions", width: 10, money: "deductions", cell: (x) => dash(x.deductions, true), text: (x) => (x.deductions ? `-${formatAmount(x.deductions)}` : "-") },
  { key: "net", label: "Net pay", width: 11, money: "net", cell: (x) => <span className="font-semibold">{formatAmount(x.net)}</span>, text: (x) => formatAmount(x.net) },
];
const PRESETS: { label: string; keys: string[] }[] = [
  { label: "Everything", keys: COLUMNS.map((c) => c.key) },
  { label: "For the bank", keys: ["employee", "bank", "account", "net"] },
  { label: "Name and net pay", keys: ["employee", "net"] },
];
const COLS_KEY = "depot.salary-schedule.columns";

/** The salary schedule: who is paid what and where, ready to print or to upload to a bank or payment platform. ?id=<run> picks the run. */
function SchedulePage() {
  const fromUrl = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("id") ?? "";
  const [chosen, setChosen] = useState(fromUrl);
  const [viewing, setViewing] = useState<Payslip | null>(null);
  const s = useSession();
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ["payroll-runs", "all"], queryFn: () => api<Paginated<PayrollRun>>("/payroll-runs") });
  const usable = (runs.data?.data ?? []).filter((r) => r.status !== "void");
  const known = (runs.data?.data ?? []).some((r) => String(r.id) === chosen);
  const id = (runs.data && !known ? "" : chosen) || String(usable.find((r) => r.status === "approved")?.id ?? usable[0]?.id ?? "");
  const run = useQuery({ queryKey: ["payroll-run", id], enabled: !!id, queryFn: () => api<PayrollRun>(`/payroll-runs/${id}`) });
  const r = run.data;
  const [colKeys, setColKeys] = useState<string[]>(COLUMNS.map((c) => c.key));
  // The last choice is remembered on this device.
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(COLS_KEY) ?? "null"); if (Array.isArray(v) && v.length) setColKeys(v); } catch { /* first visit */ }
  }, []);
  const chooseCols = (keys: string[]) => {
    const next = COLUMNS.map((c) => c.key).filter((k) => keys.includes(k));
    if (!next.length) return;
    setColKeys(next);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };
  const cols = COLUMNS.filter((c) => colKeys.includes(c.key));
  const firstMoney = cols.findIndex((c) => c.money);
  const lead = firstMoney === -1 ? cols.length : firstMoney;
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  /** Uses the business details as the server holds them right now, not the copy cached on this device. */
  const makePdf = async () => {
    if (!r) return;
    setPdfBusy(true); setPdfNote(null);
    try {
      const st = (await api<Session>("/auth/me")).store;
      const logo = st?.logo_url ? await fetch(`${API_URL}${st.logo_url}`, { headers: authHeaders() }).then((x) => (x.ok ? x.blob() : null)).catch(() => null) : null;
      const jpeg = logo ? await logoJpeg(URL.createObjectURL(logo)) : null;
      const missing = [!st?.name && "name", !st?.logo_url && "logo", !st?.phone && "phone", !st?.email && "email"].filter(Boolean);
      if (missing.length) setPdfNote(`Your business ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not saved yet, so ${missing.length === 1 ? "it" : "they"} can't appear on the PDF. Add ${missing.length === 1 ? "it" : "them"} on the My business page.`);
      else if (logo && !jpeg) setPdfNote("The logo could not be read, so it was left off the PDF. Try uploading it again as PNG or JPEG.");
      downloadBlob(`salary-schedule-${r.period}.pdf`, tablePdf({
        title: `Salary schedule - ${monthLabel(r.period)}`, subtitle: `${r.number} - ${RUN_LABEL[r.status]} - ${rows.length} staff`,
        head: cols.map((c) => c.label),
        widths: cols.map((c) => Math.round((c.width / cols.reduce((n, x) => n + x.width, 0)) * 102)), right: cols.map((c) => !!c.money),
        rows: rows.map((x) => cols.map((c) => c.text(x))),
        foot: cols.map((c, i) => (c.money ? (c.money === "deductions" ? `-${formatAmount(sum(c.money))}` : formatAmount(sum(c.money))) : i === 0 ? "Total" : "")),
      }, { name: st?.name ?? "", lines: [st?.address, st?.phone && `Tel: ${st.phone}`, st?.email && `Email: ${st.email}`].filter(Boolean) as string[] }, jpeg));
    } catch (e) { setPdfNote((e as Error).message); } finally { setPdfBusy(false); }
  };
  const approve = useMutation({
    mutationFn: () => api(`/payroll-runs/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-run", id] }); qc.invalidateQueries({ queryKey: ["payroll-runs"] }); },
  });
  const rows = scheduleRows(r?.payslips ?? []);
  const sum = (k: "basic" | "rewards" | "other_earnings" | "deductions" | "net") => rows.reduce((n, x) => n + x[k], 0);
  const missing = rows.filter((x) => !x.ready);
  const payable = rows.filter((x) => x.ready);

  return (
    <>
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } html, body { background: #fff !important; } }`}</style>
      <div className="mb-4 hidden border-b border-line pb-3 print:block"><BusinessHeader /></div>
      <PageHeader
        title="Salary schedule"
        crumb={<Link href="/payroll" className="text-[#f40009] hover:underline print:hidden">← Payroll</Link>}
        description="Who is paid what, and into which account. Download it to upload to your bank or payment platform, or print it."
        action={r && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" onClick={() => download(`salary-schedule-${r.period}.csv`, fullCsv(r, rows))}>Download schedule (CSV)</Button>
            <Button onClick={() => download(`bank-upload-${r.period}.csv`, bankCsv(r, rows))} disabled={!payable.length}><Svg d={ICON.cash} /> Download bank upload file</Button>
            <Button variant="secondary" busy={pdfBusy} onClick={() => void makePdf()}>Download PDF</Button>
            <Button variant="secondary" onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button>
          </div>
        )}
      />

      <div className="mb-4 max-w-sm print:hidden">
        <SelectField label="Payroll month" value={id} onChange={setChosen}
          options={usable.length ? usable.map((x) => ({ value: x.id, label: `${monthLabel(x.period)} · ${RUN_LABEL[x.status]} · ${x.number}` })) : [{ value: "", label: runs.isLoading ? "Loading…" : "No payroll runs yet" }]} />
      </div>
      {pdfNote && <div className="mb-3"><ErrorNote>{pdfNote}</ErrorNote></div>}
      {r && (
        <>
          <p className="mb-3 hidden print:block"><b>{monthLabel(r.period)}</b> · {r.number}</p>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="To be paid" value={formatKobo(sum("net"))} note={`${rows.length} staff`} />
            <Stat label="Sales rewards" value={formatKobo(sum("rewards"))} tone="green" note="Included above" />
            <Stat label="Deductions" value={formatKobo(sum("deductions"))} tone="amber" />
            <Stat label="Status" value={RUN_LABEL[r.status]} note={r.paid_at ? "Paid" : undefined} />
          </div>
          {r.status === "draft" && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
              <span>This run is still a <b>draft</b>, so these figures can change. Approve it before sending the file to the bank.</span>
              {s.can("payroll.approve")
                ? <Button busy={approve.isPending} onClick={() => { if (window.confirm("Approve this run? Salaries are booked and staff charges are recovered.")) approve.mutate(); }}>Approve run</Button>
                : <span className="text-xs">You need approval rights to approve it.</span>}
            </div>
          )}
          {approve.error && <div className="mb-3"><ErrorNote>{(approve.error as Error).message}</ErrorNote></div>}
          {missing.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <b>{missing.length} {missing.length === 1 ? "person has" : "people have"} no account number</b> and {missing.length === 1 ? "is" : "are"} left out of the bank upload file: {missing.map((m) => m.name).join(", ")}. Add their bank details on the Employees page.
            </div>
          )}
        </>
      )}

      <div className="mb-3 rounded-2xl border border-line bg-surface p-3 text-sm shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Columns to show, print and download:</span>
          {PRESETS.map((pr) => (
            <button key={pr.label} type="button" onClick={() => chooseCols(pr.keys)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${pr.keys.join() === colKeys.join() ? "border-[#f40009] bg-[#fff1f1] text-[#f40009]" : "border-line bg-white hover:bg-paper"}`}>{pr.label}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {COLUMNS.map((c) => (
            <label key={c.key} className="inline-flex items-center gap-1.5">
              <input type="checkbox" className="size-4 accent-[#f40009]" checked={colKeys.includes(c.key)} disabled={colKeys.length === 1 && colKeys.includes(c.key)}
                onChange={() => chooseCols(colKeys.includes(c.key) ? colKeys.filter((k) => k !== c.key) : [...colKeys, c.key])} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <TableCard min={cols.length > 4 ? "60rem" : "30rem"}>
        <thead className={theadClass}>
          <tr>{cols.map((c) => <th key={c.key} className={`${thClass} ${c.money ? "text-right" : ""}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(runs.isLoading || run.isLoading) && <TableLoading cols={cols.length} />}
          {run.error && <TableError cols={cols.length} message={(run.error as Error).message} />}
          {r && rows.length === 0 && <TableEmpty cols={cols.length} title="No payslips in this run" />}
          {rows.map((x) => (
            <tr key={x.id} onClick={() => setViewing((r?.payslips ?? []).find((p) => p.id === x.id) ?? null)} className="cursor-pointer hover:bg-paper">
              {cols.map((c) => <td key={c.key} className={`px-4 py-3 ${c.money ? "text-right tabular-nums" : ""}`}>{c.cell(x)}</td>)}
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="bg-paper font-semibold">
              {lead > 0 && <td className="px-4 py-3" colSpan={lead}>Total</td>}
              {cols.slice(lead).map((c) => (
                <td key={c.key} className={`px-4 py-3 ${c.money ? "text-right tabular-nums" : ""}`}>{c.money ? `${c.money === "deductions" ? "−" : ""}${formatAmount(sum(c.money))}` : ""}</td>
              ))}
            </tr>
          )}
        </tbody>
      </TableCard>

      {viewing && r && (
        <Modal title={`${viewing.employee.name} · ${monthLabel(r.period)}`} onClose={() => setViewing(null)}>
          <p className="mb-2 text-xs text-ink-soft">{viewing.employee.staff_no}{viewing.employee.job_title ? ` · ${viewing.employee.job_title}` : ""}</p>
          <table className="w-full text-sm">
            <tbody>
              {viewing.lines.map((l) => (
                <tr key={l.id} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5">{l.label}{l.source === "target" && <Badge tone="good">Sales reward</Badge>}{l.source === "staff_charge" && <Badge tone="warn">Staff charge</Badge>}{l.source === "overtime" && <Badge tone="good">Overtime</Badge>}</td>
                  <td className={`py-1.5 text-right tabular-nums ${l.kind === "deduction" ? "text-[#c23a3a]" : ""}`}>{l.kind === "deduction" ? "−" : ""}{formatKobo(l.amount)}</td>
                </tr>
              ))}
              <tr><td className="pt-2 font-semibold">Net pay</td><td className="pt-2 text-right font-semibold tabular-nums">{formatKobo(viewing.net)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-soft">{viewing.employee.bank_name ? `${viewing.employee.bank_name} · ${viewing.employee.account_number ?? ""} · ${viewing.employee.account_name ?? ""}` : "No bank details on file"}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Link href={`/payroll/payslip?id=${r.id}&slip=${viewing.id}`}><Button variant="secondary">Print payslip</Button></Link>
            <Button onClick={() => setViewing(null)}>Close</Button>
          </div>
        </Modal>
      )}

      <p className="mt-3 text-xs text-ink-soft print:hidden">The bank upload file has one line per person: beneficiary, account number, bank name, amount, narration and a reference.</p>
    </>
  );
}

export default withSuspense(SchedulePage);
