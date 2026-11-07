"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Field, Modal, PageHeader, SelectField, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import type { Paginated, StockCountDoc } from "../../../lib/types";

const COUNT_TONE = { counting: "warn", submitted: "neutral", approved: "good", cancelled: "bad" } as const;
const COUNT_LABEL = { counting: "Counting", submitted: "Waiting for approval", approved: "Approved", cancelled: "Cancelled" } as const;

export default function StockCountsPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/stock-counts", page],
    queryFn: () => api<Paginated<StockCountDoc>>(`/stock-counts?page=${page}`),
  });

  const th = "px-4 py-2.5 font-medium";

  return (
    <>
      <PageHeader
        title="Stock counts"
        description="Count what is physically in a warehouse and compare it with the system. Approving a count corrects the ledger to match."
        action={s.can("inventory.count") && <Button onClick={() => setStarting(true)}>Start a count</Button>}
      />

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Number</th>
              <th scope="col" className={th}>Warehouse</th>
              <th scope="col" className={th}>Started by</th>
              <th scope="col" className={th}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={5} />}
            {error && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-soft">No counts yet.</td></tr>}
            {data?.data.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.number}<p className="text-xs font-normal text-ink-soft">{formatDateTime(c.created_at)}</p></td>
                <td className="px-4 py-3">{c.warehouse?.name}</td>
                <td className="px-4 py-3">{c.creator?.name}</td>
                <td className="px-4 py-3"><Badge tone={COUNT_TONE[c.status]}>{COUNT_LABEL[c.status]}</Badge></td>
                <td className="px-4 py-3 text-right"><Link href={`/stock-counts/view?id=${c.id}`} className="font-semibold text-[#f40009] hover:underline">{c.status === "counting" ? "Continue" : "Open"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
          <span>Page {data.current_page} of {data.last_page}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {starting && <StartCount onClose={() => setStarting(false)} />}
    </>
  );
}

function StartCount({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const warehouses = useOptions("/warehouses");
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");

  const start = useMutation({
    mutationFn: () => api<StockCountDoc>("/stock-counts", { method: "POST", body: { warehouse_id: Number(warehouseId), note: note || null } }),
    onSuccess: (doc) => router.push(`/stock-counts/view?id=${doc.id}`),
  });

  return (
    <Modal title="Start a stock count" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); start.mutate(); }} className="space-y-4">
        <SelectField label="Warehouse" value={warehouseId} onChange={setWarehouseId} required options={[{ value: "", label: "Select a warehouse" }, ...warehouses]} />
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Month-end count" />
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
          Pause sales and transfers in this warehouse while counting. The system records what it expects now, and you enter what you find.
        </p>
        {start.error && <p role="alert" className="text-sm text-[#c23a3a]">{(start.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={start.isPending} disabled={!warehouseId}>Start counting</Button>
        </div>
      </form>
    </Modal>
  );
}
