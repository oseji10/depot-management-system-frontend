"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge, Card, ErrorNote, PageHeader, TableCard, TableLoading, filterClass, theadClass, thClass } from "../../../components/ui";
import { OverviewReport } from "../../../components/overview-report";
import { api } from "../../../lib/api";
import { formatAmount, formatDate } from "../../../lib/format";
import { ACCOUNT_TYPE_LABEL } from "../../../lib/status";
import type { Account, AccountType, Paginated } from "../../../lib/types";

type Row = { id: number; code: string; name: string; amount: number };
type Section = { rows: Row[]; total: number };

const TABS = [
  { key: "overview", label: "Business overview" },
  { key: "income", label: "Income statement" },
  { key: "balance", label: "Balance sheet" },
  { key: "trial", label: "Trial balance" },
  { key: "ledger", label: "General ledger" },
  { key: "inventory", label: "Inventory check" },
] as const;

type Tab = (typeof TABS)[number]["key"];

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

function DateInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-ink-soft">
      {label}
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={filterClass} />
    </label>
  );
}

function Controls({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-sm">{children}</div>;
}

function Money({ kobo, strong }: { kobo: number; strong?: boolean }) {
  return <span className={`${strong ? "font-semibold" : ""} ${kobo < 0 ? "text-[#c23a3a]" : ""}`}>{formatAmount(kobo)}</span>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reports" description="A summary of the whole business, plus the accounting statements read straight from posted journals." />

      <div role="tablist" aria-label="Report" className="mb-4 inline-flex max-w-full flex-wrap rounded-xl border border-line bg-surface p-1 shadow-sm">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-3.5 py-2 text-sm ${tab === t.key ? "bg-gradient-to-b from-[#ff3b3f] to-[#f40009] font-semibold text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewReport />}
      {tab === "income" && <IncomeStatement />}
      {tab === "balance" && <BalanceSheet />}
      {tab === "trial" && <TrialBalance />}
      {tab === "ledger" && <GeneralLedger />}
      {tab === "inventory" && <InventoryCheck />}
    </div>
  );
}

function StatementBlock({ title, section }: { title: string; section: Section }) {
  return (
    <>
      <tr className="bg-[#fff5f5]"><th colSpan={2} scope="colgroup" className="px-5 py-2.5 text-left text-xs font-semibold tracking-wider text-ink-soft uppercase">{title}</th></tr>
      {section.rows.length === 0 && <tr><td colSpan={2} className="px-5 py-2.5 text-ink-soft">Nothing recorded</td></tr>}
      {section.rows.map((r) => (
        <tr key={r.id}>
          <td className="px-5 py-2.5"><span className="mr-2 font-mono text-xs text-ink-soft">{r.code}</span>{r.name}</td>
          <td className="px-5 py-2.5 text-right"><Money kobo={r.amount} /></td>
        </tr>
      ))}
      <tr className="border-t border-line font-semibold">
        <td className="px-5 py-2.5">Total {title.toLowerCase()}</td>
        <td className="px-5 py-2.5 text-right"><Money kobo={section.total} strong /></td>
      </tr>
    </>
  );
}

function Total({ label, kobo, tone }: { label: string; kobo: number; tone?: "result" }) {
  return (
    <tr className={tone === "result" ? "border-t-2 border-[#ff3b3f]/40 bg-[#ffe9ea] text-base font-bold" : "border-t border-line bg-[#fff5f5] font-semibold"}>
      <td className="px-5 py-3">{label}</td>
      <td className="px-5 py-3 text-right"><Money kobo={kobo} strong /></td>
    </tr>
  );
}

function IncomeStatement() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const q = useQuery({
    queryKey: ["report", "income", from, to],
    enabled: !!from && !!to && from <= to,
    queryFn: () => api<{ revenue: Section; cogs: Section; gross_profit: number; other_income: Section; expenses: Section; operating_result: number }>(
      `/reports/income-statement?from=${from}&to=${to}`),
  });

  return (
    <>
      <Controls>
        <DateInput id="is-from" label="From" value={from} onChange={setFrom} />
        <DateInput id="is-to" label="To" value={to} onChange={setTo} />
      </Controls>
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      <TableCard min="28rem">
        <tbody className="divide-y divide-line text-sm">
          {q.isLoading && <TableLoading cols={2} rows={6} />}
          {q.data && (
            <>
              <StatementBlock title="Revenue" section={q.data.revenue} />
              <StatementBlock title="Cost of sales" section={q.data.cogs} />
              <Total label="Gross profit" kobo={q.data.gross_profit} />
              <StatementBlock title="Other income" section={q.data.other_income} />
              <StatementBlock title="Operating expenses" section={q.data.expenses} />
              <Total label="Operating result" kobo={q.data.operating_result} tone="result" />
            </>
          )}
        </tbody>
      </TableCard>
      <p className="mt-3 text-xs text-ink-soft">Operating result = revenue − cost of sales + other income − operating expenses. A depot sells close to cost, so rebates (under other income) usually decide the result.</p>
    </>
  );
}

function BalanceSheet() {
  const [asOf, setAsOf] = useState(today());

  const q = useQuery({
    queryKey: ["report", "balance", asOf],
    enabled: !!asOf,
    queryFn: () => api<{
      assets: Section; liabilities: Section; equity: Section; current_earnings: number; total_equity: number;
      total_liabilities_and_equity: number; balanced: boolean;
    }>(`/reports/balance-sheet?as_of=${asOf}`),
  });

  return (
    <>
      <Controls><DateInput id="bs-asof" label="As at" value={asOf} onChange={setAsOf} /></Controls>
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      <TableCard min="28rem">
        <tbody className="divide-y divide-line text-sm">
          {q.isLoading && <TableLoading cols={2} rows={6} />}
          {q.data && (
            <>
              <StatementBlock title="Assets" section={q.data.assets} />
              <StatementBlock title="Liabilities" section={q.data.liabilities} />
              <StatementBlock title="Equity" section={q.data.equity} />
              <tr><td className="px-5 py-2.5">Profit to date (not yet closed into equity)</td><td className="px-5 py-2.5 text-right"><Money kobo={q.data.current_earnings} /></td></tr>
              <Total label="Total liabilities and equity" kobo={q.data.total_liabilities_and_equity} tone="result" />
            </>
          )}
        </tbody>
      </TableCard>
      {q.data && (
        <p className={`mt-3 text-sm font-medium ${q.data.balanced ? "text-[#f40009]" : "text-[#c23a3a]"}`}>
          {q.data.balanced ? "Assets equal liabilities plus equity." : "The balance sheet does not balance. Investigate before closing the period."}
        </p>
      )}
    </>
  );
}

function TrialBalance() {
  const [asOf, setAsOf] = useState(today());

  const q = useQuery({
    queryKey: ["report", "trial", asOf],
    enabled: !!asOf,
    queryFn: () => api<{
      rows: { id: number; code: string; name: string; type: AccountType; debit: number; credit: number }[];
      total_debit: number; total_credit: number; balanced: boolean;
    }>(`/reports/trial-balance?as_of=${asOf}`),
  });

  return (
    <>
      <Controls><DateInput id="tb-asof" label="As at" value={asOf} onChange={setAsOf} /></Controls>
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      <TableCard min="34rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Account</th>
            <th scope="col" className={thClass}>Type</th>
            <th scope="col" className={`${thClass} text-right`}>Debit</th>
            <th scope="col" className={`${thClass} text-right`}>Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={4} />}
          {q.data?.rows.map((r) => (
            <tr key={r.id} className="hover:bg-[#fff5f5]">
              <td className="px-5 py-3"><span className="mr-2 font-mono text-xs text-ink-soft">{r.code}</span>{r.name}</td>
              <td className="px-4 py-3 text-ink-soft">{ACCOUNT_TYPE_LABEL[r.type]}</td>
              <td className="px-4 py-3 text-right">{r.debit ? formatAmount(r.debit) : ""}</td>
              <td className="px-4 py-3 text-right">{r.credit ? formatAmount(r.credit) : ""}</td>
            </tr>
          ))}
          {q.data?.rows.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-ink-soft">Nothing has been posted yet.</td></tr>}
        </tbody>
        {q.data && (
          <tfoot className="border-t border-line bg-[#fff5f5] font-semibold">
            <tr>
              <td className="px-5 py-3" colSpan={2}>Total {q.data.balanced ? <Badge tone="good">Balanced</Badge> : <Badge tone="bad">Out of balance</Badge>}</td>
              <td className="px-4 py-3 text-right">{formatAmount(q.data.total_debit)}</td>
              <td className="px-4 py-3 text-right">{formatAmount(q.data.total_credit)}</td>
            </tr>
          </tfoot>
        )}
      </TableCard>
    </>
  );
}

function GeneralLedger() {
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const accounts = useQuery({
    queryKey: ["options", "/accounts", "coded"],
    queryFn: async () => (await api<Paginated<Account>>("/accounts?per_page=200")).data.filter((a) => a.is_active),
  });

  const q = useQuery({
    queryKey: ["report", "ledger", accountId, from, to],
    enabled: !!accountId,
    queryFn: () => api<{
      account: { code: string; name: string };
      opening_balance: number; closing_balance: number; truncated: boolean;
      rows: { entry_id: number; number: string; date: string; memo: string; debit: number; credit: number; balance: number }[];
    }>(`/reports/general-ledger?account_id=${accountId}&from=${from}&to=${to}`),
  });

  return (
    <>
      <Controls>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Account
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${filterClass} min-w-56`}>
            <option value="">Choose an account</option>
            {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </label>
        <DateInput id="gl-from" label="From" value={from} onChange={setFrom} />
        <DateInput id="gl-to" label="To" value={to} onChange={setTo} />
      </Controls>
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      {!accountId && <Card><p className="text-sm text-ink-soft">Choose an account to see every posting to it, with a running balance.</p></Card>}
      {accountId && (
        <TableCard min="40rem">
          <thead className={theadClass}>
            <tr>
              <th scope="col" className={`${thClass} px-5`}>Date</th>
              <th scope="col" className={thClass}>Entry</th>
              <th scope="col" className={thClass}>Description</th>
              <th scope="col" className={`${thClass} text-right`}>Debit</th>
              <th scope="col" className={`${thClass} text-right`}>Credit</th>
              <th scope="col" className={`${thClass} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {q.isLoading && <TableLoading cols={6} />}
            {q.data && (
              <>
                <tr className="bg-[#fff5f5] text-ink-soft"><td className="px-5 py-2.5" colSpan={5}>Opening balance</td><td className="px-4 py-2.5 text-right"><Money kobo={q.data.opening_balance} /></td></tr>
                {q.data.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-[#fff5f5]">
                    <td className="px-5 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3"><Link href={`/journals/view?id=${r.entry_id}`} className="font-mono text-xs font-semibold text-[#f40009] hover:underline">{r.number}</Link></td>
                    <td className="max-w-xs truncate px-4 py-3" title={r.memo}>{r.memo}</td>
                    <td className="px-4 py-3 text-right">{r.debit ? formatAmount(r.debit) : ""}</td>
                    <td className="px-4 py-3 text-right">{r.credit ? formatAmount(r.credit) : ""}</td>
                    <td className="px-4 py-3 text-right"><Money kobo={r.balance} /></td>
                  </tr>
                ))}
                <tr className="bg-[#fff5f5] font-semibold"><td className="px-5 py-3" colSpan={5}>Closing balance</td><td className="px-4 py-3 text-right"><Money kobo={q.data.closing_balance} strong /></td></tr>
              </>
            )}
          </tbody>
        </TableCard>
      )}
      {q.data?.truncated && <p className="mt-3 text-xs text-ink-soft">Showing the first 2,000 lines. Narrow the dates to see the rest.</p>}
    </>
  );
}

function InventoryCheck() {
  const q = useQuery({
    queryKey: ["report", "inventory"],
    queryFn: () => api<{
      general_ledger_balance: number; cost_records_value: number; value_difference: number; reconciled: boolean;
      quantity_mismatches: { product_id: number; name: string; stock_ledger_quantity: number; cost_record_quantity: number; difference: number }[];
    }>("/reports/inventory-reconciliation"),
  });

  return (
    <>
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      {q.data && (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{q.data.reconciled ? "Books and shelves agree" : "Books and shelves do not agree"}</p>
                <p className="text-sm text-ink-soft">Compares the inventory account, the stock valuation and the quantities in the stock ledger.</p>
              </div>
              <Badge tone={q.data.reconciled ? "good" : "bad"}>{q.data.reconciled ? "Reconciled" : "Needs attention"}</Badge>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-[#fff5f5] p-3"><dt className="text-ink-soft">Inventory account</dt><dd className="mt-0.5 text-lg font-semibold">{formatAmount(q.data.general_ledger_balance)}</dd></div>
              <div className="rounded-xl bg-[#fff5f5] p-3"><dt className="text-ink-soft">Stock valuation</dt><dd className="mt-0.5 text-lg font-semibold">{formatAmount(q.data.cost_records_value)}</dd></div>
              <div className="rounded-xl bg-[#fff5f5] p-3"><dt className="text-ink-soft">Difference</dt><dd className={`mt-0.5 text-lg font-semibold ${q.data.value_difference ? "text-[#c23a3a]" : "text-[#f40009]"}`}>{formatAmount(q.data.value_difference)}</dd></div>
            </dl>
          </Card>

          {q.data.quantity_mismatches.length > 0 && (
            <TableCard min="32rem">
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={`${thClass} px-5`}>Product</th>
                  <th scope="col" className={`${thClass} text-right`}>Stock ledger</th>
                  <th scope="col" className={`${thClass} text-right`}>Valuation</th>
                  <th scope="col" className={`${thClass} text-right`}>Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.quantity_mismatches.map((m) => (
                  <tr key={m.product_id}>
                    <td className="px-5 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-right">{m.stock_ledger_quantity}</td>
                    <td className="px-4 py-3 text-right">{m.cost_record_quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#c23a3a]">{m.difference}</td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </>
      )}
    </>
  );
}
