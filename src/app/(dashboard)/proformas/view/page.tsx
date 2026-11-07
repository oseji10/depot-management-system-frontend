"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteButton } from "../../../../components/delete-button";
import { PrintSheet } from "../../../../components/print-sheet";
import { withSuspense } from "../../../../components/suspense-page";
import { Badge, Button, Modal, SelectField } from "../../../../components/ui";
import { WhatsAppButton } from "../../../../components/whatsapp-button";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatKobo } from "../../../../lib/format";
import { PROFORMA_LABEL, PROFORMA_TONE } from "../../../../lib/status";
import type { Paginated, Proforma, ProformaStatus, Warehouse } from "../../../../lib/types";

function message(p: Proforma, storeName: string) {
  const out = [`*${storeName}*`, `PROFORMA INVOICE ${p.number}`, `Date: ${formatDate(p.issued_on)}`];
  if (p.valid_until) out.push(`Valid until: ${formatDate(p.valid_until)}`);
  out.push(`For: ${p.customer_name}`, "");
  for (const l of p.lines ?? []) out.push(`${l.quantity} x ${l.description} @ ${formatKobo(l.unit_price)} = ${formatKobo(l.line_total)}`);
  if (p.discount > 0) out.push(`Discount: -${formatKobo(p.discount)}`);
  if (p.delivery_fee > 0) out.push(`Delivery: ${formatKobo(p.delivery_fee)}`);
  out.push("", `*Total: ${formatKobo(p.total)}*`);
  if (p.terms) out.push("", p.terms);
  return out.join("\n");
}

function ProformaPage() {
  const id = useIdParam();
  const s = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [converting, setConverting] = useState(false);

  const doc = useQuery({ queryKey: ["proforma", id], enabled: !!id, queryFn: () => api<Proforma>(`/proformas/${id}`) });
  const p = doc.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["proforma", id] });
    queryClient.invalidateQueries({ queryKey: ["list", "/proformas"] });
  };

  const setStatus = useMutation({
    mutationFn: (status: ProformaStatus) => api(`/proformas/${id}/status`, { method: "POST", body: { status } }),
    onSuccess: refresh,
  });

  if (!p) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const manage = s.can("proformas.manage");
  const open = ["draft", "sent", "accepted"].includes(p.status);
  const th = "py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft";

  const actions = (
    <>
      <WhatsAppButton phone={p.customer_phone} text={message(p, s.store?.name ?? "")} label="WhatsApp" />
      {manage && open && <Link href={`/proformas/edit?id=${p.id}`}><Button variant="secondary">Edit</Button></Link>}
    </>
  );

  return (
    <>
      <PrintSheet
        back={{ href: "/proformas", label: "Proforma invoices" }}
        title="Proforma invoice"
        subtitle={<><p className="font-mono font-bold">{p.number}</p><p>{formatDate(p.issued_on)}</p>{p.valid_until && <p>Valid until {formatDate(p.valid_until)}</p>}</>}
        actions={actions}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Prepared for</p>
            <p className="font-semibold">{p.customer_name}</p>
            {p.customer_address && <p>{p.customer_address}</p>}
            {p.customer_phone && <p>{p.customer_phone}</p>}
            {p.customer_email && <p>{p.customer_email}</p>}
          </div>
          <div className="print:hidden">
            <Badge tone={PROFORMA_TONE[p.status]}>{PROFORMA_LABEL[p.status]}</Badge>
            {p.is_expired && <span className="ml-1"><Badge tone="warn">Expired</Badge></span>}
            {p.converted_sale_id && <p className="mt-1 text-xs"><Link href={`/sales/view?id=${p.converted_sale_id}`} className="font-semibold text-[#f40009] hover:underline">Open the sale →</Link></p>}
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="border-b border-line">
            <tr><th className={th}>Item</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {p.lines?.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{formatKobo(l.unit_price)}</td>
                <td className="py-2 text-right font-medium">{formatKobo(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 ml-auto w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt>Goods</dt><dd>{formatKobo(p.subtotal)}</dd></div>
          {p.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatKobo(p.discount)}</dd></div>}
          {p.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatKobo(p.delivery_fee)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><dt>Total</dt><dd>{formatKobo(p.total)}</dd></div>
        </dl>

        {p.notes && <p className="mt-5 whitespace-pre-line">{p.notes}</p>}
        {p.terms && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Terms</p>
            <p className="whitespace-pre-line">{p.terms}</p>
          </div>
        )}
        <p className="mt-6 text-xs text-ink-soft">This is a quotation, not a receipt. Prices and availability are subject to change after the validity date.</p>
      </PrintSheet>

      {manage && (
        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
          {p.status === "draft" && <Button variant="secondary" busy={setStatus.isPending} onClick={() => setStatus.mutate("sent")}>Mark as sent</Button>}
          {p.status === "sent" && <Button variant="secondary" busy={setStatus.isPending} onClick={() => setStatus.mutate("accepted")}>Customer accepted</Button>}
          {open && s.can("sales.create") && <Button onClick={() => setConverting(true)}>Convert to sale</Button>}
          {open && <Button variant="ghost" busy={setStatus.isPending} onClick={() => setStatus.mutate("cancelled")}>Cancel proforma</Button>}
          {p.status === "cancelled" && <Button variant="secondary" busy={setStatus.isPending} onClick={() => setStatus.mutate("draft")}>Reopen as draft</Button>}
          {p.status !== "converted" && <DeleteButton path={`/proformas/${p.id}`} noun="proforma" onDone={() => router.push("/proformas")} />}
          {setStatus.error && <p role="alert" className="w-full text-sm text-[#c23a3a]">{(setStatus.error as Error).message}</p>}
        </div>
      )}

      {converting && <ConvertModal proforma={p} onClose={() => setConverting(false)} onDone={(saleId) => { refresh(); router.push(`/sales/view?id=${saleId}`); }} />}
    </>
  );
}

function ConvertModal({ proforma, onClose, onDone }: { proforma: Proforma; onClose: () => void; onDone: (saleId: number) => void }) {
  const warehouses = useQuery({ queryKey: ["pos", "warehouses"], queryFn: () => api<Paginated<Warehouse>>("/warehouses?per_page=100") });
  const list = warehouses.data?.data.filter((w) => w.is_active) ?? [];
  const [warehouseId, setWarehouseId] = useState("");
  const chosen = warehouseId || String(list.find((w) => w.is_default)?.id ?? list[0]?.id ?? "");

  const go = useMutation({
    mutationFn: () => api<{ sale_id: number }>(`/proformas/${proforma.id}/convert`, { method: "POST", body: { warehouse_id: Number(chosen) } }),
    onSuccess: (r) => onDone(r.sale_id),
  });

  return (
    <Modal title={`Convert ${proforma.number} to a sale`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          This takes the stock out of the warehouse you choose and records a sale of {formatKobo(proforma.total - proforma.delivery_fee + proforma.discount)} in goods, at the quoted prices.
          {proforma.customer_id ? " Nothing is marked as paid, so it stays on the customer's account until you record payment on the sale." : " This quote has no customer on file. Edit it and pick one first, since a sale with nothing paid must be on credit."}
        </p>
        <SelectField label="Take stock from" value={chosen} onChange={setWarehouseId} options={list.map((w) => ({ value: w.id, label: w.name }))} />
        {go.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{(go.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={go.isPending} disabled={!chosen} onClick={() => go.mutate()}>Convert</Button>
        </div>
      </div>
    </Modal>
  );
}

export default withSuspense(ProformaPage);
