"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, TableCard, theadClass, thClass } from "../../../components/ui";
import { api } from "../../../lib/api";
import { formatDate, formatKobo, nairaToKobo } from "../../../lib/format";
import type { Plan, PlatformSubscriptions, SubscriptionPayment, SubscriptionState } from "../../../lib/types";

type Row = PlatformSubscriptions["data"][number];
type Dialog = { kind: "trial" | "payment" | "override" | "extend" | "history"; row: Row } | { kind: "plan"; plan: Plan | null } | null;

const day = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "–");
const stateLabel = (s: SubscriptionState) => `${s.overridden ? "Override: " : ""}${s.mode === "full" ? (s.kind === "trial" ? "Trial" : "Active") : s.mode === "readonly" ? "Read-only" : "Blocked"}`;

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const q = useQuery({ queryKey: ["platform-subscriptions"], queryFn: () => api<PlatformSubscriptions>("/platform/subscriptions") });
  const d = q.data;
  const put = (v: PlatformSubscriptions) => qc.setQueryData(["platform-subscriptions"], v);

  return (
    <div>
      <PageHeader title="Subscriptions" description="Every business's plan, trials, payments, and manual overrides." action={<Button variant="secondary" onClick={() => setDialog({ kind: "plan", plan: null })}>New plan</Button>} />
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}
      {d && <Defaults settings={d.settings} onSaved={put} />}

      <TableCard min="56rem">
        <thead className={theadClass}><tr><th scope="col" className={`${thClass} px-5`}>Business</th><th scope="col" className={thClass}>Status</th><th scope="col" className={thClass}>Plan</th><th scope="col" className={thClass}>Ends</th><th scope="col" className={`${thClass} text-right`}>Actions</th></tr></thead>
        <tbody className="divide-y divide-line">
          {d?.data.map((r) => {
            const s = r.subscription;
            return (
              <tr key={r.id}>
                <td className="px-5 py-3.5"><span className="font-semibold">{r.name}</span><span className="block text-xs text-ink-soft">{r.email}</span></td>
                <td className="px-4 py-3.5"><Badge tone={s.mode === "full" ? "good" : s.mode === "readonly" ? "warn" : "bad"}>{stateLabel(s)}</Badge>{s.override_note && <span className="mt-1 block text-xs text-ink-soft">{s.override_note}</span>}</td>
                <td className="px-4 py-3.5">{s.plan ?? (s.kind === "trial" ? "Free trial" : "–")}</td>
                <td className="px-4 py-3.5 text-ink-soft">{s.ends_at ? `${day(s.ends_at)}${s.days_left != null ? ` (${s.days_left}d)` : ""}` : "No end"}</td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  {(["trial", "payment", "extend", "override", "history"] as const).map((k) => (
                    <button key={k} className="ml-3 text-sm font-semibold text-[#f40009] hover:underline" onClick={() => setDialog({ kind: k, row: r })}>{{ trial: "Issue trial", payment: "Record payment", extend: "Add days", override: "Override", history: "Payments" }[k]}</button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Plans</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {d?.plans.map((p) => (
          <Card key={p.id}>
            <p className="font-semibold">{p.name} {!p.is_active && <Badge tone="neutral">Hidden</Badge>}</p>
            <p className="text-lg font-bold">{formatKobo(p.price)} <span className="text-sm font-normal text-ink-soft">/ {p.months}mo</span></p>
            <p className="text-xs text-ink-soft">Up to {p.max_businesses} business{p.max_businesses === 1 ? "" : "es"}</p>
            <button className="mt-2 text-sm font-semibold text-[#f40009] hover:underline" onClick={() => setDialog({ kind: "plan", plan: p })}>Edit</button>
          </Card>
        ))}
      </div>

      {dialog?.kind === "plan" && <PlanModal plan={dialog.plan} onClose={() => setDialog(null)} onSaved={put} />}
      {dialog && dialog.kind !== "plan" && dialog.kind !== "history" && <ActionModal dialog={dialog as { kind: "trial" | "payment" | "override" | "extend"; row: Row }} plans={d?.plans ?? []} settings={d?.settings} onClose={() => setDialog(null)} onSaved={put} />}
      {dialog?.kind === "history" && <History row={dialog.row} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Defaults({ settings, onSaved }: { settings: PlatformSubscriptions["settings"]; onSaved: (v: PlatformSubscriptions) => void }) {
  const [trial, setTrial] = useState(String(settings.trial_days));
  const [ro, setRo] = useState(String(settings.readonly_days));
  const [maxB, setMaxB] = useState(String(settings.default_max_businesses));
  const save = useMutation({ mutationFn: () => api<PlatformSubscriptions>("/platform/subscription-settings", { method: "PUT", body: { trial_days: Number(trial), readonly_days: Number(ro), default_max_businesses: Number(maxB) } }), onSuccess: onSaved });

  return (
    <Card>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-wrap items-end gap-3">
        <Field label="Free trial length (days)" type="number" min={1} value={trial} onChange={(e) => setTrial(e.target.value)} />
        <Field label="Read-only after it ends (days)" type="number" min={0} value={ro} onChange={(e) => setRo(e.target.value)} hint="Then access is blocked" />
        <Field label="Businesses one owner can create (trial / no plan)" type="number" min={1} value={maxB} onChange={(e) => setMaxB(e.target.value)} hint="Plans can allow more" />
        <Button type="submit" busy={save.isPending}>Save defaults</Button>
        {save.isSuccess && <span className="pb-2 text-sm text-[#f40009]">Saved</span>}
      </form>
      <p className="mt-2 text-xs text-ink-soft">New businesses get the trial automatically. Each business can have its own read-only period under Override.</p>
    </Card>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: (v: PlatformSubscriptions) => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [desc, setDesc] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(plan ? String(plan.price / 100) : "");
  const [months, setMonths] = useState(String(plan?.months ?? 1));
  const [maxBusinesses, setMaxBusinesses] = useState(String(plan?.max_businesses ?? 1));
  const [active, setActive] = useState(plan ? !!plan.is_active : true);
  const run = useMutation({
    mutationFn: () => api<PlatformSubscriptions>(plan ? `/platform/plans/${plan.id}` : "/platform/plans", { method: plan ? "PUT" : "POST", body: { name, description: desc || null, price: nairaToKobo(price), months: Number(months), max_businesses: Number(maxBusinesses), is_active: active } }),
    onSuccess: (v) => { onSaved(v); onClose(); },
  });
  return (
    <Modal title={plan ? "Edit plan" : "New plan"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Field label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <MoneyField label="Price for the whole period" value={price} onChange={setPrice} required />
        <Field label="Months each payment buys" type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
        <Field label="Businesses an owner on this plan can create" type="number" min={1} value={maxBusinesses} onChange={(e) => setMaxBusinesses(e.target.value)} hint="Counting the first one" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Offer this plan to customers</label>
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={run.isPending} disabled={!name.trim() || nairaToKobo(price) <= 0}>Save</Button></div>
      </form>
    </Modal>
  );
}

function ActionModal({ dialog, plans, settings, onClose, onSaved }: { dialog: { kind: "trial" | "payment" | "override" | "extend"; row: Row }; plans: Plan[]; settings?: PlatformSubscriptions["settings"]; onClose: () => void; onSaved: (v: PlatformSubscriptions) => void }) {
  const row = dialog.row;
  const sub = row.subscription;
  const [days, setDays] = useState(dialog.kind === "trial" ? String(settings?.trial_days ?? 14) : "30");
  const [planId, setPlanId] = useState("");
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState(sub.override_note ?? "");
  const [mode, setMode] = useState(sub.overridden ? sub.mode : "");
  const [until, setUntil] = useState(sub.override_until?.slice(0, 10) ?? "");
  const [ro, setRo] = useState(sub.readonly_days != null ? String(sub.readonly_days) : "");

  const pickPlan = (v: string) => { setPlanId(v); const p = plans.find((x) => String(x.id) === v); if (p) { setMonths(String(p.months)); setAmount(String(p.price / 100)); } };

  const base = `/platform/subscriptions/${row.id}`;
  const run = useMutation({
    mutationFn: () => {
      if (dialog.kind === "trial") return api<PlatformSubscriptions>(`${base}/trial`, { method: "POST", body: { days: Number(days) } });
      if (dialog.kind === "extend") return api<PlatformSubscriptions>(`${base}/extend`, { method: "POST", body: { days: Number(days) } });
      if (dialog.kind === "payment") return api<PlatformSubscriptions>(`${base}/payment`, { method: "POST", body: { plan_id: planId ? Number(planId) : null, months: Number(months), amount: nairaToKobo(amount), reference: reference || null, note: note || null } });
      return api<PlatformSubscriptions>(`${base}/override`, { method: "PUT", body: { mode: mode || null, until: mode && until ? until : null, note: note || null, readonly_days: ro === "" ? null : Number(ro) } });
    },
    onSuccess: (v) => { onSaved(v); onClose(); },
  });

  const title = { trial: "Issue a free trial", extend: "Add free days", payment: "Record a payment", override: "Override access" }[dialog.kind];

  return (
    <Modal title={`${title}: ${row.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4">
        {dialog.kind === "trial" && <><p className="text-sm text-ink-soft">Starts a fresh free trial from today, replacing the current period.</p><Field label="Trial length (days)" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} autoFocus /></>}
        {dialog.kind === "extend" && <><p className="text-sm text-ink-soft">Adds days to the current end date, or to today if it has already ended.</p><Field label="Days to add" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} autoFocus /></>}
        {dialog.kind === "payment" && (
          <>
            <p className="text-sm text-ink-soft">For money they paid you directly. Time is added after whatever they have left.</p>
            <SelectField label="Plan (optional)" value={planId} onChange={pickPlan} options={[{ value: "", label: "No plan, custom" }, ...plans.map((p) => ({ value: p.id, label: `${p.name} · ${formatKobo(p.price)}` }))]} />
            <Field label="Months to add" type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
            <MoneyField label="Amount received" value={amount} onChange={setAmount} />
            <Field label="Reference (transfer ID)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}
        {dialog.kind === "override" && (
          <>
            <p className="text-sm text-ink-soft">An override beats the dates. Choose “Follow the dates” to remove it.</p>
            <SelectField label="Access" value={mode} onChange={setMode} options={[{ value: "", label: "Follow the dates" }, { value: "full", label: "Full access" }, { value: "readonly", label: "Read-only" }, { value: "blocked", label: "Blocked" }]} />
            {mode && <Field label="Until (blank = until you change it)" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />}
            {mode && <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why?" />}
            <Field label="Read-only days after it ends (blank = platform default)" type="number" min={0} value={ro} onChange={(e) => setRo(e.target.value)} />
          </>
        )}
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={run.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}

function History({ row, onClose }: { row: Row; onClose: () => void }) {
  const q = useQuery({ queryKey: ["platform-subscription-payments", row.id], queryFn: () => api<{ data: SubscriptionPayment[] }>(`/platform/subscriptions/${row.id}/payments`) });
  return (
    <Modal title={`Payments: ${row.name}`} onClose={onClose} wide>
      <div className="space-y-2 text-sm">
        {q.data?.data.length === 0 && <p className="text-ink-soft">No payments yet.</p>}
        {q.data?.data.map((p) => (
          <div key={p.id} className="flex justify-between border-b border-line py-2 last:border-0">
            <span>{day(p.paid_at)} · <span className="capitalize">{p.method}</span> · {p.status}{p.reference ? ` · ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}</span>
            <span className="font-semibold">{formatKobo(p.amount)} / {p.months}mo</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
