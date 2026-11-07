"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { emptyLine, LinesEditor, toBaseQty, type StockLine } from "../../../components/lines-editor";
import { Button, Field, Modal, PageHeader, SelectField, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import type { Paginated, Transfer } from "../../../lib/types";

export default function TransfersPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/stock-transfers", page],
    queryFn: () => api<Paginated<Transfer>>(`/stock-transfers?page=${page}`),
  });

  const th = "px-4 py-2.5 font-medium";

  return (
    <>
      <PageHeader
        title="Stock transfers"
        description="Move saleable stock between warehouses. Stock leaves one and arrives in the other in a single step."
        action={s.can("inventory.transfer") && <Button onClick={() => setCreating(true)}>New transfer</Button>}
      />

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Number</th>
              <th scope="col" className={th}>From</th>
              <th scope="col" className={th}>To</th>
              <th scope="col" className={th}>Products</th>
              <th scope="col" className={th}>By</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={6} />}
            {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">No transfers yet.</td></tr>}
            {data?.data.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.number}<p className="text-xs font-normal text-ink-soft">{formatDateTime(t.posted_at)}</p></td>
                <td className="px-4 py-3">{t.from_warehouse?.name}</td>
                <td className="px-4 py-3">{t.to_warehouse?.name}</td>
                <td className="px-4 py-3">{t.lines_count}</td>
                <td className="px-4 py-3">{t.creator?.name}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => setViewing(t.id)} className="font-semibold text-[#f40009] hover:underline">View</button></td>
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

      {creating && <NewTransfer onClose={() => setCreating(false)} />}
      {viewing !== null && <ViewTransfer id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function ViewTransfer({ id, onClose }: { id: number; onClose: () => void }) {
  const doc = useQuery({ queryKey: ["transfer", id], queryFn: () => api<Transfer>(`/stock-transfers/${id}`) });
  const t = doc.data;

  return (
    <Modal title={t ? `${t.number}: ${t.from_warehouse?.name} → ${t.to_warehouse?.name}` : "Transfer"} onClose={onClose}>
      {!t ? <p className="text-sm text-ink-soft">Loading…</p> : (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">By {t.creator?.name} on {formatDateTime(t.posted_at)}{t.note && <><br />“{t.note}”</>}</p>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {t.lines?.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 px-3 py-2">
                <span>{l.product?.name} <span className="text-ink-soft">· {l.product?.sku}</span></span>
                <span className="font-medium">{l.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function NewTransfer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const warehouses = useOptions("/warehouses");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockLine[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const complete = !!from && !!to && from !== to && lines.every((l) => l.product && toBaseQty(l) > 0);

  const save = useMutation({
    mutationFn: () =>
      api("/stock-transfers", {
        method: "POST",
        body: {
          from_warehouse_id: Number(from), to_warehouse_id: Number(to), note: note || null,
          lines: lines.map((l) => ({ product_id: l.product!.id, quantity: toBaseQty(l) })),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
      onClose();
    },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  return (
    <Modal title="New stock transfer" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="From warehouse" value={from} onChange={setFrom} required options={[{ value: "", label: "Select" }, ...warehouses]} error={errors.from_warehouse_id?.[0]} />
          <SelectField label="To warehouse" value={to} onChange={setTo} required options={[{ value: "", label: "Select" }, ...warehouses.filter((w) => String(w.value) !== from)]} error={errors.to_warehouse_id?.[0]} />
        </div>

        <LinesEditor lines={lines} setLines={setLines} errors={errors} />

        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        {formError && !Object.keys(errors).length && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!complete}>Transfer stock</Button>
        </div>
      </form>
    </Modal>
  );
}
