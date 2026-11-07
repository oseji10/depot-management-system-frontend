"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Field, Modal, PageHeader } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatDateTime, formatNaira } from "../../../../lib/format";
import { GRN_LABEL, GRN_TONE } from "../../../../lib/status";
import type { GoodsReceipt } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function GoodsReceiptPage() {
  const id = useIdParam();
  const s = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");

  const doc = useQuery({ queryKey: ["goods-receipt", id], queryFn: () => api<GoodsReceipt>(`/goods-receipts/${id}`) });
  const r = doc.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["goods-receipt", id] });
    queryClient.invalidateQueries({ queryKey: ["list"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
  };

  const post = useMutation({ mutationFn: () => api(`/goods-receipts/${id}/post`, { method: "POST" }), onSuccess: refresh });
  const reverse = useMutation({
    mutationFn: () => api(`/goods-receipts/${id}/reverse`, { method: "POST", body: { reason } }),
    onSuccess: () => { setReversing(false); refresh(); },
  });
  const remove = useMutation({
    mutationFn: () => api(`/goods-receipts/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["list"] }); router.replace("/goods-receipts"); },
  });

  if (!r) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const lines = r.lines ?? [];
  const total = lines.reduce((sum, l) => sum + l.accepted * Number(l.unit_cost), 0);
  const th = "px-4 py-2.5 font-medium";
  const error = (post.error ?? remove.error) as Error | null;

  return (
    <>
      <Link href="/goods-receipts" className="mb-2 inline-block text-sm text-ink-soft hover:underline">← Goods receipts</Link>

      <PageHeader
        title={`${r.number} · ${r.supplier?.name}`}
        description={`Received ${formatDate(r.received_on)} into ${r.warehouse?.name}${r.supplier_reference ? `, delivery note ${r.supplier_reference}` : ""}${r.purchase_order ? `, order ${r.purchase_order.number}` : ""}.`}
        action={<Badge tone={GRN_TONE[r.status]}>{GRN_LABEL[r.status]}</Badge>}
      />

      {r.status === "posted" && <p className="mb-3 text-sm text-ink-soft">Posted by {r.poster?.name} on {r.posted_at ? formatDateTime(r.posted_at) : ""}. Stock was added from the accepted and damaged quantities.</p>}
      {r.status === "reversed" && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">Reversed: {r.reversal_reason}. The stock it added has been taken out again.</p>}
      {r.status === "draft" && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">Draft. Nothing has been added to stock yet.</p>}

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Product</th>
              <th scope="col" className={`${th} text-right`}>Delivered</th>
              <th scope="col" className={`${th} text-right`}>Accepted</th>
              <th scope="col" className={`${th} text-right`}>Damaged</th>
              <th scope="col" className={`${th} text-right`}>Rejected</th>
              <th scope="col" className={`${th} text-right`}>Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{l.product?.name}</p>
                  <p className="text-xs text-ink-soft">{l.product?.sku} · counted in {l.unit?.name.toLowerCase()}s{l.reason ? ` · ${l.reason}` : ""}{l.expiry_date ? ` · expires ${l.expiry_date}${l.batch_no ? ` (batch ${l.batch_no})` : ""}` : ""}</p>
                </td>
                <td className="px-4 py-3 text-right">{l.delivered}</td>
                <td className="px-4 py-3 text-right font-medium text-[#f40009]">{l.accepted}</td>
                <td className="px-4 py-3 text-right">{l.damaged || <span className="text-ink-soft">–</span>}</td>
                <td className="px-4 py-3 text-right">{l.rejected || <span className="text-ink-soft">–</span>}</td>
                <td className="px-4 py-3 text-right">{formatNaira(l.accepted * Number(l.unit_cost))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-paper">
            <tr><td colSpan={6} className="px-4 py-2.5 text-right font-medium">Accepted goods {formatNaira(total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{error.message}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {r.status === "draft" && s.can("goods-receipts.record") && (
          <>
            <Button variant="danger" busy={remove.isPending} onClick={() => { if (window.confirm("Delete this draft?")) remove.mutate(); }}>Delete draft</Button>
            <Link href={`/goods-receipts/edit?id=${r.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-paper">Edit</Link>
          </>
        )}
        {r.status === "draft" && s.can("goods-receipts.post") && <Button busy={post.isPending} onClick={() => post.mutate()}>Verify and post to stock</Button>}
        {r.status === "posted" && s.can("goods-receipts.reverse") && <Button variant="danger" onClick={() => setReversing(true)}>Reverse receipt</Button>}
      </div>

      {reversing && (
        <Modal title={`Reverse ${r.number}`} onClose={() => setReversing(false)}>
          <form onSubmit={(e) => { e.preventDefault(); reverse.mutate(); }} className="space-y-4">
            <p className="text-sm text-ink-soft">This removes the stock the receipt added. It only works if those goods are still in the warehouse.</p>
            <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            {reverse.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{(reverse.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReversing(false)}>Back</Button>
              <Button type="submit" variant="danger" busy={reverse.isPending} disabled={!reason.trim()}>Reverse receipt</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default withSuspense(GoodsReceiptPage);
