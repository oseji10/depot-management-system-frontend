"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { receiptToInitial, ReceiptForm } from "../../../../components/receipt-form";
import { PageHeader } from "../../../../components/ui";
import { api } from "../../../../lib/api";
import type { GoodsReceipt } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function EditReceiptPage() {
  const id = useIdParam();
  const doc = useQuery({ queryKey: ["goods-receipt", id], queryFn: () => api<GoodsReceipt>(`/goods-receipts/${id}`) });
  const r = doc.data;

  if (!r) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;
  if (r.status !== "draft") return <p className="text-sm text-ink-soft">Only a draft receipt can be edited.</p>;

  return (
    <>
      <Link href={`/goods-receipts/view?id=${r.id}`} className="mb-2 inline-block text-sm text-ink-soft hover:underline">← {r.number}</Link>
      <PageHeader title={`Edit ${r.number}`} description="Nothing has been added to stock yet. Correct the counts, then save and post." />
      <ReceiptForm initial={receiptToInitial(r)} />
    </>
  );
}

export default withSuspense(EditReceiptPage);
