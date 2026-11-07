"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  Badge, Button, Card, ErrorNote, Field, Modal, PageHeader, SelectField, TableCard, TableLoading, theadClass, thClass,
} from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatDateTime, formatKobo } from "../../../../lib/format";
import { METHOD_LABEL, REBATE_LABEL, REBATE_TONE, TREATMENT_LABEL } from "../../../../lib/status";
import type { Paginated, RebateCalculation } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

type Source = {
  id: number; receipt_id: number; receipt_number: string; received_on: string; supplier_reference: string | null;
  product_name: string; category_name: string; cases: number; value: number; cases_assumed: boolean | number;
};

const cases = (n: number) => new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(n);

function RebateDetailPage() {
  const id = useIdParam();
  const s = useSession();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"void" | "settle" | null>(null);
  const [showSources, setShowSources] = useState(false);

  const doc = useQuery({ queryKey: ["rebate", id], queryFn: () => api<RebateCalculation>(`/rebate-calculations/${id}`) });
  const sources = useQuery({
    queryKey: ["rebate-sources", id], enabled: showSources,
    queryFn: () => api<Paginated<Source>>(`/rebate-calculations/${id}/sources?per_page=200`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["rebate", id] });
    queryClient.invalidateQueries({ queryKey: ["list", "/rebate-calculations"] });
    queryClient.invalidateQueries({ queryKey: ["rebate-progress"] });
    queryClient.invalidateQueries({ queryKey: ["report"] });
  };

  const approve = useMutation({ mutationFn: () => api(`/rebate-calculations/${id}/approve`, { method: "POST", body: {} }), onSuccess: refresh });
  const recalc = useMutation({
    mutationFn: (month: string) => api<RebateCalculation>("/rebate-calculations", { method: "POST", body: { month } }),
    onSuccess: () => refresh(),
  });

  const c = doc.data;
  if (!c) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const month = new Date(`${c.period_start}T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const error = (approve.error ?? recalc.error) as Error | null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Rebate · ${month}`}
        description={`${c.number} · ${c.agreement?.name ?? ""}`}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link href="/rebates"><Button variant="secondary">All rebates</Button></Link>
            <Button variant="secondary" onClick={() => window.print()}>Print statement</Button>
            {c.status === "draft" && s.can("rebates.calculate") && (
              <Button variant="secondary" busy={recalc.isPending} onClick={() => recalc.mutate(c.period_start.slice(0, 7))}>Recalculate</Button>
            )}
            {(c.status === "draft" || c.status === "approved") && s.can("rebates.calculate") && <Button variant="danger" onClick={() => setDialog("void")}>Void</Button>}
            {c.status === "draft" && s.can("rebates.approve") && <Button busy={approve.isPending} onClick={() => approve.mutate()}>Approve and book</Button>}
            {c.status === "approved" && s.can("rebates.settle") && <Button onClick={() => setDialog("settle")}>Record payment</Button>}
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error.message}</ErrorNote></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={REBATE_TONE[c.status]}>{REBATE_LABEL[c.status]}</Badge>
        {c.cluster_overridden && <Badge tone="warn">Cluster overridden</Badge>}
      </div>

      {c.status === "void" && <div className="mb-4"><ErrorNote>Voided: {c.void_reason}</ErrorNote></div>}
      {c.warnings?.map((w, i) => (
        <p key={i} className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cases were estimated from the largest pack for: {w.products.join(", ")}. Set &quot;in a physical case&quot; on those products for exact volume.
        </p>
      ))}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-soft">Cluster</p><p className="mt-0.5 text-xl font-bold">{c.cluster_name}</p>
          <p className="mt-1 text-xs text-ink-soft">{cases(c.cluster_volume)} cases, {formatDate(c.cluster_from)} to {formatDate(c.cluster_to)}</p>
          {c.override_reason && <p className="mt-1 text-xs">Override: {c.override_reason}</p>}</Card>
        <Card><p className="text-sm text-ink-soft">Eligible purchases</p><p className="mt-0.5 text-xl font-bold">{formatKobo(c.total_eligible_value)}</p></Card>
        <Card><p className="text-sm text-ink-soft">Rebate earned</p><p className="mt-0.5 text-xl font-bold text-[#f40009]">{formatKobo(c.total_rebate)}</p></Card>
      </div>

      <TableCard min="38rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Product group</th>
            <th scope="col" className={`${thClass} text-right`}>Cases</th>
            <th scope="col" className={`${thClass} text-right`}>Purchases</th>
            <th scope="col" className={`${thClass} text-right`}>Tier reached</th>
            <th scope="col" className={`${thClass} text-right`}>Rebate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {c.lines?.map((l) => (
            <tr key={l.rebate_category_id}>
              <td className="px-5 py-3.5 font-semibold">{l.category_name}</td>
              <td className="px-4 py-3.5 text-right">{cases(l.cases)}</td>
              <td className="px-4 py-3.5 text-right">{formatKobo(l.eligible_value)}</td>
              <td className="px-4 py-3.5 text-right">{l.no_tier ? <span className="text-ink-soft">None reached</span> : `${l.tier_rate}%${l.tier_from ? ` (from ${cases(l.tier_from)})` : ""}`}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(l.rebate)}</td>
            </tr>
          ))}
          {c.lines?.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-soft">No eligible goods were received this month.</td></tr>}
        </tbody>
        <tfoot className="border-t border-line bg-[#fff5f5] font-semibold">
          <tr><td className="px-5 py-3.5" colSpan={2}>Total</td><td className="px-4 py-3.5 text-right">{formatKobo(c.total_eligible_value)}</td><td /><td className="px-4 py-3.5 text-right">{formatKobo(c.total_rebate)}</td></tr>
        </tfoot>
      </TableCard>

      <p className="mt-3 text-xs text-ink-soft">
        Method: {METHOD_LABEL[c.method]}. Booked as: {TREATMENT_LABEL[c.accounting_treatment]}.
        {c.approved_at && ` Approved by ${c.approver?.name ?? "–"} on ${formatDateTime(c.approved_at)}.`}
        {c.settled_on && ` Paid ${formatDate(c.settled_on)} by ${c.settlement_method === "credit_note" ? "credit note" : "bank"}${c.settlement_reference ? ` (${c.settlement_reference})` : ""}.`}
      </p>

      <div className="mt-6 print:hidden">
        <Button variant="secondary" onClick={() => setShowSources((v) => !v)}>{showSources ? "Hide" : "Show"} the {c.sources_count ?? 0} deliveries behind this</Button>
        {showSources && (
          <div className="mt-3">
            <TableCard min="42rem">
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={`${thClass} px-5`}>Receipt</th>
                  <th scope="col" className={thClass}>Date</th>
                  <th scope="col" className={thClass}>Product</th>
                  <th scope="col" className={`${thClass} text-right`}>Cases</th>
                  <th scope="col" className={`${thClass} text-right`}>Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sources.isLoading && <TableLoading cols={5} />}
                {sources.data?.data.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3"><Link href={`/goods-receipts/view?id=${r.receipt_id}`} className="font-mono text-xs font-semibold text-[#f40009] hover:underline">{r.receipt_number}</Link>{r.supplier_reference && <span className="block text-xs text-ink-soft">{r.supplier_reference}</span>}</td>
                    <td className="px-4 py-3">{formatDate(r.received_on)}</td>
                    <td className="px-4 py-3">{r.product_name} {Boolean(r.cases_assumed) && <Badge tone="warn">Estimated</Badge>}</td>
                    <td className="px-4 py-3 text-right">{cases(r.cases)}</td>
                    <td className="px-4 py-3 text-right">{formatKobo(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </div>
        )}
      </div>

      {dialog === "void" && <VoidModal calc={c} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "settle" && <SettleModal calc={c} onClose={() => setDialog(null)} onDone={refresh} />}
    </div>
  );
}

function VoidModal({ calc, onClose, onDone }: { calc: RebateCalculation; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => api(`/rebate-calculations/${calc.id}/void`, { method: "POST", body: { reason } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title={`Void ${calc.number}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">
          {calc.status === "approved" ? "The accrual in the books is reversed, and the month can be calculated again." : "The month can be calculated again."}
        </p>
        <Field label="Why is it being voided?" value={reason} onChange={(e) => setReason(e.target.value)} required />
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" busy={run.isPending} disabled={!reason.trim()}>Void</Button>
        </div>
      </form>
    </Modal>
  );
}

function SettleModal({ calc, onClose, onDone }: { calc: RebateCalculation; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState("bank");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const run = useMutation({
    mutationFn: () => api(`/rebate-calculations/${calc.id}/settle`, { method: "POST", body: { method, settled_on: date, reference: reference || null } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title="Record the rebate payment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">{formatKobo(calc.total_rebate)} was received from Coca-Cola.</p>
        <SelectField label="How was it settled?" value={method} onChange={setMethod}
          options={[{ value: "bank", label: "Paid into the bank" }, { value: "credit_note", label: "Credit note against what we owe" }]} />
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Field label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer or credit note number" />
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={run.isPending}>Record payment</Button>
        </div>
      </form>
    </Modal>
  );
}

export default withSuspense(RebateDetailPage);
