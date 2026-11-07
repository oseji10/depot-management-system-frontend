import { monthLabel } from "./payroll";
import type { PayrollRun, Payslip } from "./types";

/** Common Nigerian banks and their NIP codes, matched on the bank name typed on the employee. Check the codes against your bank's upload template. */
const BANK_CODES: [RegExp, string][] = [
  [/\b(gtb|gtbank|guaranty)/i, "058"], [/access/i, "044"], [/zenith/i, "057"], [/\buba\b|united bank for africa/i, "033"], [/first\s*bank/i, "011"],
  [/fidelity/i, "070"], [/sterling/i, "232"], [/union/i, "032"], [/wema|alat/i, "035"], [/stanbic/i, "221"], [/fcmb|first city/i, "214"], [/polaris/i, "076"],
  [/keystone/i, "082"], [/ecobank/i, "050"], [/providus/i, "101"], [/heritage/i, "030"], [/unity/i, "215"], [/jaiz/i, "301"], [/kuda/i, "50211"],
  [/opay/i, "100004"], [/moniepoint/i, "50515"], [/palmpay/i, "100033"], [/citi/i, "023"], [/standard\s*chartered/i, "068"], [/titan/i, "000025"],
  [/globus/i, "00103"], [/taj/i, "000026"], [/parallex/i, "104"], [/premium\s*trust/i, "105"], [/suntrust/i, "100"],
];

export const bankCode = (name?: string | null) => (name ? BANK_CODES.find(([re]) => re.test(name))?.[1] ?? "" : "");

export type ScheduleRow = {
  id: number; name: string; staff_no: string; bank_name: string | null; account_number: string | null; account_name: string | null; bank_code: string;
  basic: number; rewards: number; other_earnings: number; deductions: number; net: number; ready: boolean;
};

export function scheduleRows(slips: Payslip[]): ScheduleRow[] {
  return slips.map((p) => {
    const rewards = p.lines.filter((l) => l.kind === "earning" && l.source === "target").reduce((n, l) => n + l.amount, 0);
    const earnings = p.lines.filter((l) => l.kind === "earning").reduce((n, l) => n + l.amount, 0);
    return {
      id: p.id, name: p.employee.name, staff_no: p.employee.staff_no, bank_name: p.employee.bank_name, account_number: p.employee.account_number, account_name: p.employee.account_name,
      bank_code: bankCode(p.employee.bank_name), basic: p.basic, rewards, other_earnings: earnings - p.basic - rewards, deductions: p.charges_total + p.other_deductions, net: p.net,
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
    ["Beneficiary name", "Account number", "Bank code", "Bank name", "Amount", "Narration", "Reference"],
    ...rows.filter((r) => r.ready).map((r) => [r.account_name || r.name, r.account_number, r.bank_code, r.bank_name, naira(r.net), narration, `${run.number}-${r.staff_no}`]),
  ]);
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
