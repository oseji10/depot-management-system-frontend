"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Chips, ErrorNote, ICON, Modal, PageHeader, Pager, TableCard, TableEmpty, TableError, TableLoading, inputClass, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { ApiError, api } from "../../../../lib/api";
import { formatDateTime, formatKobo } from "../../../../lib/format";
import type { Paginated, SyncIssue } from "../../../../lib/types";

type Filter = "open" | "resolved" | "dismissed";

type SalePayload = {
  lines?: { product_id: number; quantity: number; unit_price?: number }[];
  payments?: { method: string; amount: number }[];
  customer_id?: number;
  customer_ref?: string;
  sold_at?: string;
};

function describe(i: SyncIssue) {
  const p = i.payload as SalePayload & { name?: string; amount?: number; paid_to?: string };
  if (i.kind === "sale") {
    const qty = (p.lines ?? []).reduce((n, l) => n + l.quantity, 0);
    const paid = (p.payments ?? []).reduce((n, x) => n + x.amount, 0);
    return { title: `Sale of ${qty} item${qty === 1 ? "" : "s"}`, detail: `${paid ? `${formatKobo(paid)} paid` : "Nothing paid (on account)"}${p.sold_at ? ` · made ${formatDateTime(p.sold_at)}` : ""}` };
  }
  if (i.kind === "expense") return { title: `Expense of ${formatKobo(p.amount ?? 0)}`, detail: p.paid_to ?? "" };
  return { title: `New customer ${p.name ?? ""}`, detail: "" };
}

/** Things a salesperson's phone sent that the rules turned down. A manager fixes the cause and retries, or dismisses with a reason. */
export default function SyncIssuesPage() {
  const s = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<{ issue: SyncIssue; mode: "retry" | "dismiss" } | null>(null);

  const list = useQuery({
    queryKey: ["sync-issues", filter, page],
    queryFn: () => api<Paginated<SyncIssue>>(`/sync-issues?status=${filter}&page=${page}`),
    refetchInterval: filter === "open" ? 20_000 : false,
  });

  const done = () => {
    for (const key of ["sync-issues", "dashboard", "trip", "trips", "reps", "stock", "list"]) queryClient.invalidateQueries({ queryKey: [key] });
    setActing(null);
  };

  const retryAll = useMutation({
    mutationFn: () => api<{ fixed: number; still_stuck: number; example_error: string | null }>("/sync-issues/retry-all", { method: "POST" }),
    onSuccess: done,
  });
  const openCount = list.data && filter === "open" ? list.data.total : 0;

  return (
    <>
      <PageHeader title="Sync issues" description="Sales and expenses a salesperson made without signal that could not be recorded. Their stock and cash stay out of the books until you deal with them."
        action={s.can("trips.manage") && openCount > 0 && <Button busy={retryAll.isPending} onClick={() => retryAll.mutate()}>Retry all ({openCount})</Button>} />
      {retryAll.data && (
        <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${retryAll.data.still_stuck ? "bg-amber-50 text-amber-900" : "bg-[#ffe9ea] text-[#a50006]"}`}>
          {retryAll.data.fixed} recorded{retryAll.data.still_stuck ? `, ${retryAll.data.still_stuck} still stuck${retryAll.data.example_error ? ` — for example: ${retryAll.data.example_error}` : ""}` : "."}
        </p>
      )}
      {retryAll.error && <ErrorNote>{(retryAll.error as Error).message}</ErrorNote>}

      <div className="mb-4">
        <Chips<Filter> label="Status" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: "open", label: "Needs attention" }, { value: "resolved", label: "Fixed" }, { value: "dismissed", label: "Dismissed" }]} />
      </div>

      <TableCard min="46rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>What</th>
            <th scope="col" className={thClass}>Salesperson</th>
            <th scope="col" className={thClass}>Why it was turned down</th>
            {s.can("trips.manage") && <th><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={4} />}
          {list.error && <TableError cols={4} message={(list.error as Error).message} />}
          {list.data?.data.length === 0 && <TableEmpty cols={4} title={filter === "open" ? "Nothing needs attention" : "Nothing here"} icon={ICON.check} hint={filter === "open" ? "Every sale and expense from the field has been recorded." : undefined} />}
          {list.data?.data.map((i) => {
            const d = describe(i);
            return (
              <tr key={i.id}>
                <td className="px-5 py-3.5"><span className="font-semibold">{d.title}</span><span className="block text-xs text-ink-soft">{d.detail}</span><span className="block text-xs text-ink-soft">Sent {formatDateTime(i.created_at)}{i.attempts > 1 ? ` · tried ${i.attempts} times` : ""}</span></td>
                <td className="px-4 py-3.5">{i.rep?.name}{i.trip && <span className="block text-xs text-ink-soft">Trip {i.trip.number}</span>}</td>
                <td className="px-4 py-3.5">{i.status === "open" ? <span className="text-[#c23a3a]">{i.error}</span> : <><Badge tone={i.status === "resolved" ? "good" : "neutral"}>{i.status === "resolved" ? "Fixed" : "Dismissed"}</Badge><span className="block text-xs text-ink-soft">{i.resolution}</span></>}</td>
                {s.can("trips.manage") && (
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {i.status === "open" && (
                      <>
                        <button type="button" onClick={() => setActing({ issue: i, mode: "retry" })} className="mr-3 text-sm font-semibold text-[#f40009] hover:underline">Retry</button>
                        <button type="button" onClick={() => setActing({ issue: i, mode: "dismiss" })} className="text-sm font-semibold text-ink-soft hover:underline">Dismiss</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </TableCard>
      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.current_page} setPage={setPage} />}

      {acting?.mode === "retry" && <RetryModal issue={acting.issue} onClose={() => setActing(null)} onDone={done} />}
      {acting?.mode === "dismiss" && <DismissModal issue={acting.issue} onClose={() => setActing(null)} onDone={done} />}
    </>
  );
}

function RetryModal({ issue, onClose, onDone }: { issue: SyncIssue; onClose: () => void; onDone: () => void }) {
  const [reprice, setReprice] = useState(false);
  const retry = useMutation({
    mutationFn: () => api<{ result: { status: string; error?: string } }>(`/sync-issues/${issue.id}/retry`, { method: "POST", body: { reprice } }),
    onSuccess: (r) => { if (r.result.status !== "rejected") onDone(); },
  });
  const stillNo = retry.data?.result.status === "rejected" ? retry.data.result.error : null;

  return (
    <Modal title="Retry this" onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[#a42e2e]">{stillNo ?? issue.error}</p>
        <p className="text-sm text-ink-soft">Fix the cause first (receive more stock, raise the customer&apos;s credit limit, reopen a period), then retry. It is recorded as the salesperson, at the time they made it.</p>
        {issue.kind === "sale" && (
          <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={reprice} onChange={(e) => setReprice(e.target.checked)} className="mt-0.5 size-4" /> Charge today&apos;s list price instead of the price on the phone</label>
        )}
        {retry.error && <ErrorNote>{(retry.error instanceof ApiError ? retry.error.message : (retry.error as Error).message)}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={retry.isPending} onClick={() => retry.mutate()}>Retry now</Button></div>
      </div>
    </Modal>
  );
}

function DismissModal({ issue, onClose, onDone }: { issue: SyncIssue; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const dismiss = useMutation({ mutationFn: () => api(`/sync-issues/${issue.id}/dismiss`, { method: "POST", body: { reason } }), onSuccess: onDone });

  return (
    <Modal title="Dismiss without recording" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); dismiss.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">Use this when it was dealt with another way (recorded by hand, or the customer cancelled). Nothing is added to the books. The goods may still be missing from the van, which check-in will show as a shortage.</p>
        <label className="block text-sm font-medium">Reason<input autoFocus required value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-1.5`} /></label>
        {dismiss.error && <ErrorNote>{(dismiss.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={dismiss.isPending} disabled={!reason.trim()}>Dismiss</Button></div>
      </form>
    </Modal>
  );
}
