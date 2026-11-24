import { monthLabel } from "./payroll";
import type { PayrollRun, Payslip } from "./types";

export type ScheduleRow = {
  id: number; name: string; staff_no: string; bank_name: string | null; account_number: string | null; account_name: string | null;
  basic: number; rewards: number; other_earnings: number; deductions: number; net: number; ready: boolean;
};

export function scheduleRows(slips: Payslip[]): ScheduleRow[] {
  return slips.map((p) => {
    const rewards = p.lines.filter((l) => l.kind === "earning" && l.source === "target").reduce((n, l) => n + l.amount, 0);
    const earnings = p.lines.filter((l) => l.kind === "earning").reduce((n, l) => n + l.amount, 0);
    return {
      id: p.id, name: p.employee.name, staff_no: p.employee.staff_no, bank_name: p.employee.bank_name, account_number: p.employee.account_number, account_name: p.employee.account_name,
      basic: p.basic, rewards, other_earnings: earnings - p.basic - rewards, deductions: p.charges_total + p.other_deductions, net: p.net,
      ready: !!p.employee.account_number && p.net > 0,
    };
  });
}

const naira = (kobo: number) => (kobo / 100).toFixed(2);
const cell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(rows: (string | number | null)[][]): string {
  return `﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}

/** Everything on the schedule, for your own records or a spreadsheet. */
export function fullCsv(run: PayrollRun, rows: ScheduleRow[]): string {
  return toCsv([
    ["Staff no", "Name", "Bank", "Account number", "Account name", "Basic salary", "Sales rewards", "Other earnings", "Deductions", "Net pay"],
    ...rows.map((r) => [r.staff_no, r.name, r.bank_name, r.account_number, r.account_name, naira(r.basic), naira(r.rewards), naira(r.other_earnings), naira(r.deductions), naira(r.net)]),
    ["", `Total (${monthLabel(run.period)})`, "", "", "", naira(rows.reduce((n, r) => n + r.basic, 0)), naira(rows.reduce((n, r) => n + r.rewards, 0)), naira(rows.reduce((n, r) => n + r.other_earnings, 0)), naira(rows.reduce((n, r) => n + r.deductions, 0)), naira(rows.reduce((n, r) => n + r.net, 0))],
  ]);
}

/** One line per person to be paid, in the shape most banks' and payment platforms' bulk upload expects. Staff without account details are left out. */
export function bankCsv(run: PayrollRun, rows: ScheduleRow[]): string {
  const narration = `Salary ${monthLabel(run.period)}`;
  return toCsv([
    ["Beneficiary name", "Account number", "Bank name", "Amount", "Narration", "Reference"],
    ...rows.filter((r) => r.ready).map((r) => [r.account_name || r.name, r.account_number, r.bank_name, naira(r.net), narration, `${run.number}-${r.staff_no}`]),
  ]);
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
