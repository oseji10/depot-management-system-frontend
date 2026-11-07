"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DeleteButton } from "../../../components/delete-button";
import { ExpenseModal } from "../../../components/expense-modal";
import { useOffline } from "../../../components/offline-provider";
import {
  Badge, Button, Chips, ErrorNote, ICON, Modal, PageHeader, Pager, SearchBox, Stat, Svg, TableCard, TableEmpty, TableError, TableLoading, Toolbar, filterClass, inputClass, theadClass, thClass,
} from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatDate, formatKobo, formatTime } from "../../../lib/format";
import type { Expense, ExpenseList } from "../../../lib/types";

type Filter = "all" | "posted" | "void";

export default function ExpensesPage() {
  const s = useSession();
  const offline = useOffline();
  const queryClient = useQueryClient();
  const categories = useOptions("/expense-categories");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<Filter>("posted");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["expenses", page, search, category, filter, from, to],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page) });
      if (search) p.set("search", search);
      if (category) p.set("category_id", category);
      if (filter !== "all") p.set("status", filter);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      return api<ExpenseList>(`/expenses?${p}`);
    },
  });

  const sm = list.data?.summary;
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const queued = (offline?.queue ?? []).filter((q) => q.kind === "expense" && q.status !== "synced");

  return (
    <>
      <PageHeader
        title={offline ? "My expenses" : "Expenses"}
        description={offline ? "Fuel, parking and anything else you paid for while out. It comes off the cash you hand in." : "Money the depot spent, posted to the books as it is recorded."}
        action={s.can("expenses.create") && <Button onClick={() => setAdding(true)}><Svg d={ICON.plus} /> Log expense</Button>}
      />

      {notice && <p className="mb-4 rounded-xl bg-[#ffe9ea] px-4 py-3 text-sm font-medium text-[#a50006]">{notice}</p>}

      {queued.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Waiting to be sent ({queued.length})</p>
          <ul className="mt-2 divide-y divide-amber-200/70">
            {queued.map((q) => (
              <li key={q.ref} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{q.summary.title}</span><span className="text-xs text-amber-800">{formatTime(q.created_at)}{q.error ? ` · ${q.error}` : ""}</span></span>
                <span className="font-semibold tabular-nums">{formatKobo(q.summary.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total spent" value={sm ? formatKobo(sm.total) : "…"} icon={ICON.cash} tone="rose" note={sm ? `${sm.count} expense${sm.count === 1 ? "" : "s"}` : undefined} />
        {(sm?.by_category ?? []).slice(0, 3).map((c) => <Stat key={c.name} label={c.name} value={formatKobo(c.total)} icon={ICON.doc} tone="amber" note={sm && sm.total ? `${Math.round((c.total / sm.total) * 100)}% of the total` : undefined} />)}
      </div>

      <Toolbar>
        <SearchBox id="exp-search" value={search} onChange={reset(setSearch)} placeholder="Search number, payee or note" />
        {!offline && (
          <select value={category} onChange={(e) => reset(setCategory)(e.target.value)} className={filterClass} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-ink-soft">From <input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={filterClass} aria-label="From date" /></label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">To <input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className={filterClass} aria-label="To date" /></label>
      </Toolbar>

      <div className="mb-4">
        <Chips<Filter> label="Status" value={filter} onChange={reset(setFilter)} options={[{ value: "posted", label: "Recorded" }, { value: "void", label: "Void" }, { value: "all", label: "All" }]} />
      </div>

      <TableCard min="48rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Expense</th>
            <th scope="col" className={thClass}>Category</th>
            {s.level !== "branch" && !offline && <th scope="col" className={thClass}>Branch</th>}
            <th scope="col" className={thClass}>Paid from</th>
            <th scope="col" className={`${thClass} text-right`}>Amount</th>
            {s.can("expenses.manage") && <th><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={6} />}
          {list.error && <TableError cols={6} message={offline && !offline.online ? "You are offline. Expenses already sent will show again when you have a signal." : (list.error as Error).message} />}
          {list.data?.data.length === 0 && <TableEmpty cols={6} title="No expenses found" icon={ICON.cash} hint="Log an expense and it will appear here." />}
          {list.data?.data.map((r) => (
            <tr key={r.id} className={r.status === "void" ? "opacity-60" : ""}>
              <td className="px-5 py-3.5">
                <span className="font-mono text-xs font-bold text-[#f40009]">{r.number}</span>
                <span className="block text-xs text-ink-soft">{formatDate(r.expense_date)}{r.paid_to ? ` · ${r.paid_to}` : ""}{r.creator && !offline ? ` · ${r.creator.name}` : ""}</span>
                {r.description && <span className="block text-xs text-ink-soft">{r.description}</span>}
                {r.trip && <span className="block text-xs text-ink-soft">On trip {r.trip.number}</span>}
              </td>
              <td className="px-4 py-3.5">{r.category?.name}</td>
              {s.level !== "branch" && !offline && <td className="px-4 py-3.5 text-ink-soft">{r.branch?.name}</td>}
              <td className="px-4 py-3.5 text-ink-soft">{r.method === "cash" ? "Cash" : "Bank"} {r.status === "void" && <Badge tone="bad">Void</Badge>}</td>
              <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{formatKobo(r.amount)}</td>
              {s.can("expenses.manage") && (
                <td className="px-4 py-3.5 text-right">{r.status === "posted" && <button type="button" onClick={() => setVoiding(r)} className="text-sm font-semibold text-[#c23a3a] hover:underline">Void</button>}{r.status === "void" && <DeleteButton size="sm" path={`/expenses/${r.id}`} noun="expense" onDone={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })} />}</td>
              )}
            </tr>
          ))}
        </tbody>
      </TableCard>
      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.current_page} setPage={setPage} />}

      {adding && <ExpenseModal onClose={() => setAdding(false)} onSaved={setNotice} />}
      {voiding && <VoidModal expense={voiding} onClose={() => setVoiding(null)} onDone={() => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); setVoiding(null); }} />}
    </>
  );
}

function VoidModal({ expense, onClose, onDone }: { expense: Expense; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const void_ = useMutation({
    mutationFn: () => api(`/expenses/${expense.id}/void`, { method: "POST", body: { reason } }),
    onSuccess: onDone,
  });

  return (
    <Modal title={`Void ${expense.number}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void_.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">{formatKobo(expense.amount)} for {expense.category?.name} will be reversed in the books. The expense stays on record marked void.</p>
        <label className="block text-sm font-medium">Reason<input autoFocus required value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-1.5`} placeholder="Why is this being voided?" /></label>
        {void_.error && <ErrorNote>{(void_.error instanceof ApiError ? void_.error.message : (void_.error as Error).message)}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" busy={void_.isPending} disabled={!reason.trim()}>Void expense</Button></div>
      </form>
    </Modal>
  );
}
