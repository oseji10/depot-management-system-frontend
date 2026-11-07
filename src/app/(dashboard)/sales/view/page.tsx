"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, ErrorNote, Field, ICON, Modal, MoneyField, PageHeader, SelectField, Svg, TableCard, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { ApiError, api } from "../../../../lib/api";
import { formatDateTime, formatKobo, koboToInput, nairaToKobo } from "../../../../lib/format";
import { CHANNEL_LABEL, METHOD_PAY_LABEL, PAYMENT_LABEL, PAYMENT_TONE } from "../../../../lib/status";
import type { ReturnableLine, Sale, TerminalChoice, TransferAccount } from "../../../../lib/types";
import { terminalOf } from "../../../../components/terminal-select";
import { WhatsAppButton } from "../../../../components/whatsapp-button";
import { usePayTo } from "../../../../hooks/pay-to";
import { saleMessage } from "../../../../lib/share";
import { TransferTarget, transferPayload, transferReady, type TransferValue } from "../../../../components/transfer-target";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function SaleDetailPage() {
  const id = useIdParam();
  const s = useSession();
  const payTo = usePayTo();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"pay" | "void" | "return" | null>(null);

  const doc = useQuery({ queryKey: ["sale", id], queryFn: () => api<Sale>(`/sales/${id}`) });

  const refresh = () => {
    for (const key of [["sale", id], ["list", "/sales"], ["sales-summary"], ["dashboard"], ["customers"], ["customer"], ["pos"], ["report"]]) queryClient.invalidateQueries({ queryKey: key });
  };

  const sale = doc.data;
  if (!sale) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const live = sale.status === "completed";
  const payments = sale.payments ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        crumb={<Link href="/sales" className="hover:underline">← All sales</Link>}
        title={sale.number}
        description={`${formatDateTime(sale.sold_at)} · ${CHANNEL_LABEL[sale.channel]} · ${sale.branch?.name ?? ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/sales/receipt?id=${sale.id}`}><Button variant="secondary"><Svg d={ICON.print} /> Receipt</Button></Link>
            <WhatsAppButton phone={sale.customer?.phone} text={saleMessage(sale, s.store?.name ?? "", payTo).text} label={live && sale.balance_due > 0 ? "Send invoice on WhatsApp" : "Send receipt on WhatsApp"} />
            {live && sale.balance_due > 0 && s.can("sales.create") && <Button onClick={() => setDialog("pay")}><Svg d={ICON.cash} /> {sale.payment_status === "unpaid" ? "Confirm payment received" : "Record payment"}</Button>}
            {live && s.can("sales.refund") && !!sale.lines?.length && <Button variant="secondary" onClick={() => setDialog("return")}>Return items</Button>}
            {live && s.can("sales.refund") && <Button variant="danger" onClick={() => setDialog("void")}>Void sale</Button>}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {live ? <Badge tone={PAYMENT_TONE[sale.payment_status]}>{PAYMENT_LABEL[sale.payment_status]}</Badge> : <Badge tone="bad">Void</Badge>}
        {sale.customer ? <Link href={`/customers/view?id=${sale.customer.id}`} className="text-sm font-semibold text-[#f40009] hover:underline">{sale.customer.name}</Link> : <span className="text-sm text-ink-soft">Walk-in customer</span>}
      </div>

      {!live && (
        <div className="mb-4">
          <ErrorNote>Voided {sale.voided_at ? formatDateTime(sale.voided_at) : ""}: {sale.void_reason}. The goods went back into stock and the entries in the books were reversed.</ErrorNote>
          {payments.length > 0 && (
            <div className="mt-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              <p className="font-semibold">Money to hand back to the customer</p>
              <ul className="mt-1 text-ink-soft">
                {Object.entries(payments.reduce<Record<string, number>>((a, p) => ({ ...a, [p.method]: (a[p.method] ?? 0) + p.amount }), {})).map(([m, amt]) => <li key={m}>{METHOD_PAY_LABEL[m as keyof typeof METHOD_PAY_LABEL]}: <span className="font-semibold text-ink">{formatKobo(amt)}</span></li>)}
              </ul>
              <Link href={`/sales/refund?id=${sale.id}`} className="mt-2 inline-block font-semibold text-[#f40009] hover:underline">Print refund slip</Link>
            </div>
          )}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-soft">Total</p><p className="mt-0.5 text-2xl font-bold">{formatKobo(sale.total + (sale.deposit_total ?? 0))}</p>{(sale.deposit_total ?? 0) > 0 && <p className="mt-1 text-xs text-ink-soft">includes {formatKobo(sale.deposit_total ?? 0)} container deposit</p>}{sale.discount_total > 0 && <p className="mt-1 text-xs text-ink-soft">after {formatKobo(sale.discount_total)} discount</p>}</Card>
        <Card><p className="text-sm text-ink-soft">Paid</p><p className="mt-0.5 text-2xl font-bold text-[#f40009]">{formatKobo(live ? sale.amount_paid : 0)}</p></Card>
        <Card><p className="text-sm text-ink-soft">Still owed</p><p className={`mt-0.5 text-2xl font-bold ${sale.balance_due > 0 ? "text-amber-700" : ""}`}>{formatKobo(sale.balance_due)}</p></Card>
      </div>

      <TableCard min="36rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Item</th>
            <th scope="col" className={`${thClass} text-right`}>Qty</th>
            <th scope="col" className={`${thClass} text-right`}>Price</th>
            <th scope="col" className={`${thClass} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sale.lines?.map((l) => (
            <tr key={l.id}>
              <td className="px-5 py-3.5"><span className="font-semibold">{l.product?.name}</span><span className="block text-xs text-ink-soft">{l.unit?.name}{l.factor > 1 ? ` of ${l.factor}` : ""}</span></td>
              <td className="px-4 py-3.5 text-right">{l.quantity}</td>
              <td className="px-4 py-3.5 text-right">{l.unit_price < l.list_price && <span className="mr-1.5 text-xs text-ink-soft line-through">{formatKobo(l.list_price)}</span>}{formatKobo(l.unit_price)}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {!!sale.returns?.length && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Returns and credit notes</h2>
          <TableCard min="30rem">
            <tbody className="divide-y divide-line">
              {sale.returns.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3.5"><Link href={`/returns/view?id=${r.id}`} className="font-semibold hover:underline">{r.number}</Link><span className="block text-xs text-ink-soft">{formatDateTime(r.returned_at)}</span></td>
                  <td className="px-4 py-3.5 text-ink-soft">{r.refunded > 0 ? `${formatKobo(r.refunded)} paid back (${r.refund_method})` : "Taken off the balance"}</td>
                  <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Payments</h2>
      {payments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-ink-soft">No payment taken yet.</p>
      ) : (
        <TableCard min="30rem">
          <tbody className="divide-y divide-line">
            {payments.map((p) => (
              <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                <td className="px-5 py-3.5"><span className="font-semibold">{METHOD_PAY_LABEL[p.method]}</span>{p.terminal && <span className="ml-2 text-xs text-ink-soft">{p.terminal.name}</span>}{p.transfer_to === "account" && p.account && <span className="ml-2 text-xs text-ink-soft">→ {p.account.name}</span>}{p.transfer_to === "pos" && <span className="ml-2 text-xs text-ink-soft">→ POS account</span>}{p.reference && <span className="ml-2 text-xs text-ink-soft">{p.reference}</span>}{p.voided_at && <span className="ml-2"><Badge tone="bad">Reversed</Badge></span>}{!p.voided_at && <Link href={`/sales/payment-receipt?id=${sale.id}&payment=${p.id}`} className="ml-3 text-xs font-semibold text-[#f40009] hover:underline">Receipt</Link>}</td>
                <td className="px-4 py-3.5 text-ink-soft">{formatDateTime(p.paid_at)} · {p.receiver?.name}</td>
                <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {dialog === "pay" && <PayModal sale={sale} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "return" && <ReturnModal sale={sale} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "void" && <VoidModal sale={sale} onClose={() => setDialog(null)} onDone={refresh} />}
    </div>
  );
}

function PayModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(koboToInput(sale.balance_due));
  const [reference, setReference] = useState("");
  const [terminal, setTerminal] = useState<number | undefined>();
  const [transfer, setTransfer] = useState<TransferValue>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const kobo = nairaToKobo(amount);
  const machines = useQuery({ queryKey: ["terminals", "available", sale.branch?.id], queryFn: () => api<{ data: TerminalChoice[]; accounts?: TransferAccount[] }>(`/pos-terminals/available${sale.branch?.id ? `?branch_id=${sale.branch.id}` : ""}`) });
  const terminals = machines.data?.data ?? [];
  const accounts = machines.data?.accounts ?? [];
  const needTransfer = method === "transfer" && !transferReady({ ...transfer, to: transfer.to ?? (terminals.length ? undefined : "account") }, terminals, terminal);
  const needTerminal = method === "pos" && terminals.length > 0 && !terminalOf(terminal, terminals);

  const run = useMutation({
    mutationFn: () => api(`/sales/${sale.id}/payments`, { method: "POST", body: { method, amount: kobo, reference: reference || null, ...(method === "pos" && terminalOf(terminal, terminals) ? { pos_terminal_id: terminalOf(terminal, terminals) } : {}), ...(method === "transfer" ? transferPayload({ ...transfer, to: transfer.to ?? (terminals.length ? undefined : "account") }, terminals, terminal) : {}) } }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}),
  });

  return (
    <Modal title="Take a payment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); run.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">{formatKobo(sale.balance_due)} is still owed on {sale.number}{sale.customer ? ` by ${sale.customer.name}` : ""}.</p>
        <SelectField label="How are they paying?" value={method} onChange={setMethod} options={Object.entries(METHOD_PAY_LABEL).map(([value, label]) => ({ value, label }))} />
        {method === "transfer" && machines.data && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Where was the transfer paid?</p>
            <TransferTarget accounts={accounts} terminals={terminals} value={transfer} terminal={terminal} indent={false} onChange={setTransfer} onTerminal={setTerminal} />
            {errors.payments?.[0] && <p className="mt-1.5 text-xs text-[#c23a3a]">{errors.payments[0]}</p>}
          </div>
        )}
        {method === "pos" && terminals.length > 0 && (
          <SelectField label="Card terminal" value={String(terminalOf(terminal, terminals) ?? "")} onChange={(v) => setTerminal(Number(v))}
            options={[{ value: "", label: "Which terminal?" }, ...terminals.map((t) => ({ value: t.id, label: t.name }))]} error={errors.payments?.[0]} required />
        )}
        <MoneyField label="Amount" value={amount} onChange={setAmount} error={errors.amount?.[0]} required autoFocus />
        <Field label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer reference or POS slip" />
        {run.error && !Object.keys(errors).length && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={run.isPending} disabled={kobo <= 0 || kobo > sale.balance_due || needTerminal || needTransfer}>Record {kobo > 0 ? formatKobo(kobo) : "payment"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ReturnModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const lines = useQuery({ queryKey: ["returnable", sale.id], queryFn: () => api<{ data: ReturnableLine[] }>(`/sales/${sale.id}/returnable`) });
  const [qty, setQty] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState("saleable");
  const [method, setMethod] = useState("cash");
  const rows = lines.data?.data ?? [];
  const picked = rows.map((l) => ({ l, n: Math.min(Math.max(parseInt(qty[l.sale_line_id] ?? "0", 10) || 0, 0), l.left) })).filter((x) => x.n > 0);
  const total = picked.reduce((a, x) => a + x.n * x.l.unit_price, 0);
  const applied = Math.min(total, sale.balance_due);
  const refund = total - applied;

  const run = useMutation({
    mutationFn: () => api<{ id: number }>(`/sales/${sale.id}/returns`, { method: "POST", body: {
      reason, restock_status: restock, refund_method: refund > 0 ? method : null, lines: picked.map((x) => ({ sale_line_id: x.l.sale_line_id, quantity: x.n })),
    } }),
    onSuccess: (r) => { onDone(); onClose(); router.push(`/returns/view?id=${r.id}`); },
  });

  return (
    <Modal title={`Return items from ${sale.number}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4">
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.sale_line_id} className="flex items-center justify-between gap-3 text-sm">
              <div><span className="font-semibold">{l.product}</span><span className="block text-xs text-ink-soft">{l.unit} · {l.left} left of {l.sold} · {formatKobo(l.unit_price)} each</span></div>
              <input aria-label={`Quantity of ${l.product} to return`} type="number" min={0} max={l.left} disabled={l.left === 0} value={qty[l.sale_line_id] ?? ""} onChange={(e) => setQty({ ...qty, [l.sale_line_id]: e.target.value })} className="w-20 rounded-xl border border-line px-3 py-2 text-right" placeholder="0" />
            </div>
          ))}
        </div>
        <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
        <SelectField label="Condition of the goods" value={restock} onChange={setRestock} options={[{ value: "saleable", label: "Good, put back on the shelf" }, { value: "damaged", label: "Damaged, keep apart" }]} />
        <p className="rounded-xl bg-surface p-3 text-sm">Credit value <b>{formatKobo(total)}</b>. {applied > 0 && <>{formatKobo(applied)} comes off what the customer owes. </>}{refund > 0 && <>{formatKobo(refund)} is paid back to them.</>}</p>
        {refund > 0 && <SelectField label="Paid back by" value={method} onChange={setMethod} options={[{ value: "cash", label: "Cash" }, { value: "transfer", label: "Bank transfer" }]} />}
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={run.isPending} disabled={total <= 0 || !reason.trim()}>Issue credit note</Button>
        </div>
      </form>
    </Modal>
  );
}

function VoidModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => api(`/sales/${sale.id}/void`, { method: "POST", body: { reason } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title={`Void ${sale.number}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">The goods go back into stock and the entries in the books are reversed. Any money already received must be handed back to the customer by you.</p>
        <Field label="Why is it being voided?" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Keep sale</Button>
          <Button type="submit" variant="danger" busy={run.isPending} disabled={!reason.trim()}>Void sale</Button>
        </div>
      </form>
    </Modal>
  );
}

export default withSuspense(SaleDetailPage);
