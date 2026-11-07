"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PurchaseOrderForm } from "../../../../components/purchase-order-form";
import { Badge, Button, PageHeader } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatNaira } from "../../../../lib/format";
import { PO_LABEL, PO_TONE } from "../../../../lib/status";
import type { PurchaseOrder } from "../../../../lib/types";
import { formatQty } from "../../../../lib/units";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function PurchaseOrderPage() {
  const id = useIdParam();
  const s = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const doc = useQuery({ queryKey: ["purchase-order", id], queryFn: () => api<PurchaseOrder>(`/purchase-orders/${id}`) });
  const po = doc.data;

  const act = useMutation({
    mutationFn: (action: "issue" | "cancel") => api(`/purchase-orders/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["list", "/purchase-orders"] });
    },
  });

  if (!po) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const manage = s.can("purchasing.manage");
  const th = "px-4 py-2.5 font-medium";

  return (
    <>
      <Link href="/purchase-orders" className="mb-2 inline-block text-sm text-ink-soft hover:underline">← Purchase orders</Link>

      <PageHeader
        title={`${po.number} · ${po.supplier?.name}`}
        description={`Deliver to ${po.warehouse?.name}. Ordered ${formatDate(po.order_date)}${po.expected_date ? `, expected ${formatDate(po.expected_date)}` : ""}.${po.note ? ` “${po.note}”` : ""}`}
        action={<Badge tone={PO_TONE[po.status]}>{PO_LABEL[po.status]}</Badge>}
      />

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={`${th} text-right`}>Ordered</th>
              <th scope="col" className={`${th} text-right`}>Cost each</th>
              <th scope="col" className={`${th} text-right`}>Received</th>
              <th scope="col" className={`${th} text-right`}>Still to come</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {po.lines?.map((l) => {
              const base = l.product?.base_unit?.name ?? "unit";
              const pack = l.factor > 1 && l.unit ? { name: l.unit.name, factor: l.factor } : null;
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3"><p className="font-medium">{l.product?.name}</p><p className="text-xs text-ink-soft">{l.product?.sku}</p></td>
                  <td className="px-4 py-3 text-right">{l.quantity} {l.unit?.name}{l.quantity === 1 ? "" : "s"}</td>
                  <td className="px-4 py-3 text-right">{formatNaira(Number(l.unit_cost))}</td>
                  <td className="px-4 py-3 text-right">{po.status === "draft" ? "–" : formatQty(l.received_base ?? 0, base, pack)}</td>
                  <td className="px-4 py-3 text-right">{po.status === "draft" ? "–" : (l.outstanding_base ?? 0) > 0 ? <span className="font-medium">{formatQty(l.outstanding_base ?? 0, base, pack)}</span> : <span className="text-[#f40009]">Complete</span>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-line bg-paper">
            <tr><td colSpan={5} className="px-4 py-2.5 text-right font-medium">Order value {formatNaira(Number(po.total_value ?? 0))}</td></tr>
          </tfoot>
        </table>
      </div>

      {act.error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{(act.error as Error).message}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {manage && po.status === "draft" && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
        {manage && ["draft", "ordered"].includes(po.status) && (
          <Button variant="danger" busy={act.isPending} onClick={() => { if (window.confirm("Cancel this order?")) act.mutate("cancel"); }}>Cancel order</Button>
        )}
        {manage && po.status === "draft" && <Button busy={act.isPending} onClick={() => act.mutate("issue")}>Issue to supplier</Button>}
        {s.can("goods-receipts.record") && ["ordered", "partially_received"].includes(po.status) && (
          <Link href={`/goods-receipts/new?po=${po.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#f40009] px-4 text-sm font-semibold text-white hover:bg-[#a50006]">Receive goods</Link>
        )}
      </div>

      {editing && <PurchaseOrderForm po={po} onClose={() => setEditing(false)} />}
    </>
  );
}

export default withSuspense(PurchaseOrderPage);
