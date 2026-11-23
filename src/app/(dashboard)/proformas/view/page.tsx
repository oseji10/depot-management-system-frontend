"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteButton } from "../../../../components/delete-button";
import { ProformaDocument } from "../../../../components/proforma-document";
import { withSuspense } from "../../../../components/suspense-page";
import { Badge, Button, ICON, Modal, SelectField, Svg } from "../../../../components/ui";
import { WhatsAppButton } from "../../../../components/whatsapp-button";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatKobo } from "../../../../lib/format";
import { PROFORMA_LABEL, PROFORMA_TONE } from "../../../../lib/status";
import type { Paginated, Proforma, ProformaStatus, Warehouse } from "../../../../lib/types";

function message(p: Proforma, storeName: string) {
  const out = [`*${storeName}*`, `PROFORMA INVOICE ${p.number}`];
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

  const actions = (
    <>
      <WhatsAppButton phone={p.customer_phone} text={message(p, s.store?.name ?? "")} label="WhatsApp" />
      {manage && open && <Link href={`/proformas/edit?id=${p.id}`}><Button variant="secondary">Edit</Button></Link>}
    </>
  );

  return (
    <>
      <div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/proformas" className="text-sm font-semibold text-[#f40009] hover:underline">← Proforma invoices</Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PROFORMA_TONE[p.status]}>{PROFORMA_LABEL[p.status]}</Badge>
          {p.is_expired && <Badge tone="warn">Expired</Badge>}
          {p.converted_sale_id && <Link href={`/sales/view?id=${p.converted_sale_id}`} className="text-sm font-semibold text-[#f40009] hover:underline">Open the sale →</Link>}
          {actions}
          <Button onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button>
        </div>
      </div>
      <ProformaDocument p={p} />

      {manage && (
        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center gap-2 print:hidden">
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
