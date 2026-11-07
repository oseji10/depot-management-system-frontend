"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfOk, setPdfOk] = useState<string | null>(null);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  /** Uses the business details as the server holds them right now, not the copy cached on this device. */
  const makePdf = async () => {
    if (!r) return;
    setPdfBusy(true); setPdfNote(null); setPdfOk(null);
    try {
      const st = (await api<Session>("/auth/me")).store;
      const logo = st?.logo_url ? await fetch(`${API_URL}${st.logo_url}`, { headers: authHeaders() }).then((x) => (x.ok ? x.blob() : null)).catch(() => null) : null;
      const jpeg = logo ? await logoJpeg(URL.createObjectURL(logo)) : null;
      const missing = [!st?.name && "name", !st?.logo_url && "logo", !st?.phone && "phone", !st?.email && "email"].filter(Boolean);
      if (missing.length) setPdfNote(`Your business ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not saved yet, so ${missing.length === 1 ? "it" : "they"} can't appear on the PDF. Add ${missing.length === 1 ? "it" : "them"} on the My business page.`);
      else if (logo && !jpeg) setPdfNote("The logo could not be read, so it was left off the PDF. Try uploading it again as PNG or JPEG.");
      setPdfOk(`PDF header used: ${st?.name || "(no name)"} · ${st?.phone || "(no phone)"} · ${st?.email || "(no email)"} · logo ${jpeg ? "included" : "not included"}`);
      downloadBlob(`salary-schedule-${r.period}.pdf`, tablePdf({
        title: `Salary schedule - ${monthLabel(r.period)}`, subtitle: `${r.number} - ${RUN_LABEL[r.status]} - ${rows.length} staff`,
        head: ["Employee", "Bank", "Account", "Basic", "Sales reward", "Other", "Deductions", "Net pay"],
        widths: [20, 14, 18, 10, 10, 9, 10, 11], right: [false, false, false, true, true, true, true, true],
        rows: rows.map((x) => [`${x.name} (${x.staff_no})`, x.bank_name ?? "-", x.account_number ?? "-", formatAmount(x.basic), x.rewards ? formatAmount(x.rewards) : "-", x.other_earnings ? formatAmount(x.other_earnings) : "-", x.deductions ? `-${formatAmount(x.deductions)}` : "-", formatAmount(x.net)]),
        foot: ["Total", "", "", formatAmount(sum("basic")), formatAmount(sum("rewards")), formatAmount(sum("other_earnings")), `-${formatAmount(sum("deductions"))}`, formatAmount(sum("net"))],
      }, { name: st?.name ?? "", lines: [st?.address, [st?.phone && `Tel: ${st.phone}`, st?.email && `Email: ${st.email}`].filter(Boolean).join("   ")].filter(Boolean) as string[] }, jpeg));
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

      {pdfOk && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 print:hidden">{pdfOk}</p>}
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
            <tr key={x.id} onClick={() => setViewing((r?.payslips ?? []).find((p) => p.id === x.id) ?? null)} className="cursor-pointer hover:bg-paper">
              <td className="px-4 py-3"><p className="font-medium text-[#f40009]">{x.name}</p><p className="text-xs text-ink-soft">{x.staff_no}</p></td>
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

      {viewing && r && (
        <Modal title={`${viewing.employee.name} · ${monthLabel(r.period)}`} onClose={() => setViewing(null)}>
          <p className="mb-2 text-xs text-ink-soft">{viewing.employee.staff_no}{viewing.employee.job_title ? ` · ${viewing.employee.job_title}` : ""}</p>
          <table className="w-full text-sm">
            <tbody>
              {viewing.lines.map((l) => (
                <tr key={l.id} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5">{l.label}{l.source === "target" && <Badge tone="good">Sales reward</Badge>}{l.source === "staff_charge" && <Badge tone="warn">Staff charge</Badge>}</td>
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

      <p className="mt-3 text-xs text-ink-soft print:hidden">The bank upload file has one line per person: beneficiary, account number, bank code, bank name, amount, narration and a reference. Bank codes are filled in from the bank name where it is recognised; check them against your bank&apos;s template before uploading.</p>
    </>
  );
}

export default withSuspense(SchedulePage);
