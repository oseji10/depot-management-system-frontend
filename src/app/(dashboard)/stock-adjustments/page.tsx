"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { emptyLine, LinesEditor, lineFactor, toBaseQty, type StockLine } from "../../../components/lines-editor";
import { Badge, Button, Field, Modal, PageHeader, SelectField, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import type { Adjustment, Paginated } from "../../../lib/types";
import { STATUS_LABEL } from "../../../lib/units";

type Reason = { value: string; label: string; dir: "+" | "-" | "±"; from?: string; to?: string };

const REASONS: Record<"adjustment" | "reclassify", Reason[]> = {
  adjustment: [
    { value: "opening_balance", label: "Opening balance", dir: "+" },
    { value: "found", label: "Stock found", dir: "+" },
    { value: "loss", label: "Loss", dir: "-" },
    { value: "theft", label: "Theft", dir: "-" },
    { value: "expiry_write_off", label: "Expired, written off", dir: "-" },
    { value: "damage_write_off", label: "Damaged, written off", dir: "-" },
    { value: "correction", label: "Correction", dir: "±" },
  ],
  reclassify: [
    { value: "damaged", label: "Mark as damaged", dir: "+", from: "saleable", to: "damaged" },
    { value: "expired", label: "Mark as expired", dir: "+", from: "saleable", to: "expired" },
    { value: "recovered", label: "Recovered, back to saleable", dir: "+", from: "damaged", to: "saleable" },
  ],
};

const reasonLabel = (kind: Adjustment["kind"], reason: string) => REASONS[kind].find((r) => r.value === reason)?.label ?? reason;
const tone = (st: Adjustment["status"]) => (st === "approved" ? "good" : st === "rejected" ? "bad" : "warn");

export default function AdjustmentsPage() {
  const s = useSession();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/stock-adjustments", page, status],
    queryFn: () => api<Paginated<Adjustment>>(`/stock-adjustments?page=${page}${status ? `&status=${status}` : ""}`),
  });

  const th = "px-4 py-2.5 font-medium";

  return (
    <>
      <PageHeader
        title="Stock adjustments"
        description="Opening balances, losses, write-offs and reclassifications. Stock only changes once a different approver signs the request off."
        action={s.can("inventory.adjust") && <Button onClick={() => setCreating(true)}>New adjustment</Button>}
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="adj-status">Status</label>
        <select id="adj-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Waiting for approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className={th}>Number</th>
              <th scope="col" className={th}>Warehouse</th>
              <th scope="col" className={th}>Reason</th>
              <th scope="col" className={th}>Requested by</th>
              <th scope="col" className={th}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <TableLoading cols={6} />}
            {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#c23a3a]">{(error as Error).message}</td></tr>}
            {data?.data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">No adjustments yet.</td></tr>}
            {data?.data.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium">{a.number}<p className="text-xs font-normal text-ink-soft">{formatDateTime(a.created_at)}</p></td>
                <td className="px-4 py-3">{a.warehouse?.name}</td>
                <td className="px-4 py-3">{reasonLabel(a.kind, a.reason)} <span className="text-ink-soft">· {a.lines_count} line{a.lines_count === 1 ? "" : "s"}</span></td>
                <td className="px-4 py-3">{a.creator?.name}</td>
                <td className="px-4 py-3"><Badge tone={tone(a.status)}>{a.status === "pending" ? "Waiting" : a.status[0].toUpperCase() + a.status.slice(1)}</Badge></td>
                <td className="px-4 py-3 text-right"><button onClick={() => setViewing(a.id)} className="font-semibold text-[#f40009] hover:underline">{a.status === "pending" && s.can("inventory.approve") ? "Review" : "View"}</button></td>
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

      {creating && <NewAdjustment onClose={() => setCreating(false)} />}
      {viewing !== null && <ReviewAdjustment id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function ReviewAdjustment({ id, onClose }: { id: number; onClose: () => void }) {
  const s = useSession();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const doc = useQuery({ queryKey: ["adjustment", id], queryFn: () => api<Adjustment>(`/stock-adjustments/${id}`) });

  const decide = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      api<Adjustment>(`/stock-adjustments/${id}/${action}`, { method: "POST", body: action === "reject" ? { decision_note: note } : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["adjustment", id] });
      onClose();
    },
  });

  const a = doc.data;

  return (
    <Modal title={a ? `${a.number} · ${reasonLabel(a.kind, a.reason)}` : "Adjustment"} onClose={onClose}>
      {!a ? <p className="text-sm text-ink-soft">Loading…</p> : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            {a.warehouse?.name} · requested by {a.creator?.name} on {formatDateTime(a.created_at)}
            {a.note && <><br />“{a.note}”</>}
          </p>

          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {a.lines?.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{l.product?.name} <span className="text-ink-soft">· {l.product?.sku}</span></span>
                <span className="whitespace-nowrap font-medium">
                  {a.kind === "reclassify"
                    ? `${l.quantity} ${STATUS_LABEL[l.status]} → ${STATUS_LABEL[l.to_status ?? ""]}`
                    : <span className={l.quantity < 0 ? "text-[#c23a3a]" : "text-[#f40009]"}>{l.quantity > 0 ? `+${l.quantity}` : l.quantity} {STATUS_LABEL[l.status].toLowerCase()}</span>}
                </span>
              </li>
            ))}
          </ul>

          {a.status !== "pending" && (
            <p className="text-sm"><Badge tone={tone(a.status)}>{a.status}</Badge> by {a.approver?.name}{a.decision_note ? `: ${a.decision_note}` : ""}</p>
          )}

          {a.status === "pending" && s.can("inventory.approve") && (
            rejecting ? (
              <div className="space-y-3">
                <Field label="Why is it being rejected?" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setRejecting(false)}>Back</Button>
                  <Button variant="danger" busy={decide.isPending} disabled={!note.trim()} onClick={() => decide.mutate("reject")}>Reject</Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="danger" onClick={() => setRejecting(true)}>Reject</Button>
                <Button busy={decide.isPending} onClick={() => decide.mutate("approve")}>Approve and post to stock</Button>
              </div>
            )
          )}

          {decide.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{(decide.error as Error).message}</p>}
        </div>
      )}
    </Modal>
  );
}

function NewAdjustment({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const warehouses = useOptions("/warehouses");
  const [warehouseId, setWarehouseId] = useState("");
  const [kind, setKind] = useState<"adjustment" | "reclassify">("adjustment");
  const [reason, setReason] = useState("opening_balance");
  const [direction, setDirection] = useState<"1" | "-1">("-1"); // only used by "Correction"
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockLine[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reasons = REASONS[kind];
  const current = reasons.find((r) => r.value === reason) ?? reasons[0];

  const applyReason = (k: typeof kind, r: string) => {
    const def = REASONS[k].find((x) => x.value === r);
    setLines((cur) => cur.map((l) => (k === "reclassify" && def ? { ...l, status: def.from ?? "saleable", toStatus: def.to ?? "damaged" } : l)));
  };

  const adding = kind === "adjustment" && (current.dir === "+" || (current.dir === "±" && direction === "1"));
  const needsCost = kind === "adjustment" && reason === "opening_balance";
  const complete = !!warehouseId && lines.every((l) => l.product && toBaseQty(l) > 0 && (!needsCost || Number(l.cost) > 0));

  const save = useMutation({
    mutationFn: () => {
      const sign = kind === "reclassify" ? 1 : current.dir === "+" ? 1 : current.dir === "-" ? -1 : Number(direction);
      return api("/stock-adjustments", {
        method: "POST",
        body: {
          warehouse_id: Number(warehouseId), kind, reason, note: note || null,
          lines: lines.map((l) => ({
            product_id: l.product!.id, status: l.status, to_status: kind === "reclassify" ? l.toStatus : null, quantity: sign * toBaseQty(l),
            // the form asks for cost per chosen unit (a crate); the books keep cost per bottle
            unit_cost: adding && l.cost !== "" ? Number(l.cost) / lineFactor(l) : null,
          })),
        },
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["list", "/stock-adjustments"] }); onClose(); },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  return (
    <Modal title="New stock adjustment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-4">
        <SelectField label="Warehouse" value={warehouseId} onChange={setWarehouseId} required
          options={[{ value: "", label: "Select a warehouse" }, ...warehouses]} error={errors.warehouse_id?.[0]} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="What are you doing?" value={kind}
            onChange={(v) => { const k = v as typeof kind; setKind(k); const first = REASONS[k][0].value; setReason(first); applyReason(k, first); }}
            options={[{ value: "adjustment", label: "Add or remove stock" }, { value: "reclassify", label: "Change stock status" }]} />
          <SelectField label="Reason" value={reason} onChange={(v) => { setReason(v); applyReason(kind, v); }}
            options={reasons.map((r) => ({ value: r.value, label: r.label }))} error={errors.reason?.[0]} />
        </div>

        {kind === "adjustment" && current.dir === "±" && (
          <SelectField label="Direction" value={direction} onChange={(v) => setDirection(v as "1" | "-1")}
            options={[{ value: "-1", label: "Remove stock" }, { value: "1", label: "Add stock" }]} />
        )}

        <LinesEditor lines={lines} setLines={setLines} showStatus showToStatus={kind === "reclassify"} showCost={adding} errors={errors} />
        {adding && (
          <p className="text-xs text-ink-soft">
            {needsCost ? "Enter what each unit cost you, so the opening stock can be valued in the books." : "Optional. Leave the cost empty to use the current average cost."}
          </p>
        )}

        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        {formError && !Object.keys(errors).length && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!complete}>Send for approval</Button>
        </div>
      </form>
    </Modal>
  );
}
