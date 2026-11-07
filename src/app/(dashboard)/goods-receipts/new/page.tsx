"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { emptyReceipt, ReceiptForm, todayIso, type ReceiptInitial } from "../../../../components/receipt-form";
import { PageHeader } from "../../../../components/ui";
import { api } from "../../../../lib/api";
import type { ReceiptTemplate } from "../../../../lib/types";

function NewReceipt() {
  const poId = useSearchParams().get("po");

  const template = useQuery({
    queryKey: ["receipt-template", poId],
    enabled: !!poId,
    queryFn: () => api<ReceiptTemplate>(`/purchase-orders/${poId}/receipt-template`),
  });

  if (poId && template.isLoading) return <p className="text-sm text-ink-soft">Loading the order…</p>;
  if (poId && template.error) return <p role="alert" className="text-sm text-[#c23a3a]">{(template.error as Error).message}</p>;

  const initial: ReceiptInitial = template.data
    ? {
        ...emptyReceipt(),
        poId: template.data.purchase_order.id,
        poNumber: template.data.purchase_order.number,
        supplierId: String(template.data.purchase_order.supplier_id),
        warehouseId: String(template.data.purchase_order.warehouse_id),
        receivedOn: todayIso(),
        lines: template.data.lines.map((l) => ({
          poLineId: l.purchase_order_line_id, product: l.product, unitId: String(l.unit_id), unitName: l.unit.name, factor: l.factor,
          delivered: String(l.outstanding), damaged: "", rejected: "", reason: "", cost: String(Number(l.unit_cost)), batchNo: "", expiry: "",
        })),
      }
    : emptyReceipt();

  return (
    <>
      <Link href="/goods-receipts" className="mb-2 inline-block text-sm text-ink-soft hover:underline">← Goods receipts</Link>
      <PageHeader
        title="Record a delivery"
        description="Count what actually arrived. Anything damaged or rejected is recorded separately and does not count as sellable stock."
      />
      <ReceiptForm initial={initial} />
    </>
  );
}

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
      <NewReceipt />
    </Suspense>
  );
}
