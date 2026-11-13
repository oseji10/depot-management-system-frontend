"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ProductPicker } from "../../../components/product-picker";
import { Badge, Button, Card, ErrorNote, Field, ICON, Modal, MoneyField, PageHeader, SelectField, Stat, Svg } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatKobo, nairaToKobo } from "../../../lib/format";
import { monthLabel } from "../../../lib/payroll";
import { progressText, rewardText } from "../../../lib/targets";
import type { Product, Rep, TargetLine, TargetRules, TargetsResponse } from "../../../lib/types";

const thisMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const nextMonth = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(y, m, 1).toLocaleDateString("en-CA").slice(0, 7); };
const prevMonth = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(y, m - 2, 1).toLocaleDateString("en-CA").slice(0, 7); };

export default function TargetsPage() {
  const s = useSession();
  const manage = s.can("targets.manage");
  const qc = useQueryClient();
  const [period, setPeriod] = useState(thisMonth());
  const [modal, setModal] = useState<null | "target" | "rules">(null);
  const [open, setOpen] = useState<number | null>(null);

  const data = useQuery({ queryKey: ["targets", period], queryFn: () => api<TargetsResponse>(`/targets?period=${period}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["targets"] });
  const copy = useMutation({ mutationFn: () => api<{ copied: number }>("/targets/copy", { method: "POST", body: { from: prevMonth(period), to: period } }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => api(`/targets/${id}`, { method: "DELETE" }), onSuccess: refresh });

  const reps = data.data?.reps ?? [];
  const totalReward = reps.reduce((n, r) => n + r.reward_total, 0);
  const totalFull = reps.reduce((n, r) => n + r.reward_full, 0);
  const rules = data.data?.rules;

  return (
    <>
      <PageHeader
        title="Sales targets"
        description="Set what each van salesman should sell in a month. Reaching the target earns a reward that goes on their payslip, separate from their salary."
        action={manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal("rules")}>Reward rules</Button>
            <Button variant="secondary" busy={copy.isPending} onClick={() => copy.mutate()}>Copy from {monthLabel(prevMonth(period))}</Button>
            <Button onClick={() => setModal("target")}><Svg d={ICON.plus} /> Set target</Button>
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink-soft">Month<input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="mt-1 block min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink" /></label>
        {rules && <p className="pb-2 text-xs text-ink-soft">{[...rules.tiers].sort((a, b) => b.min - a.min).map((t) => `${t.min}%+ pays ${t.pays}%`).join(" · ")} · below that, nothing{rules.pay_lag === 1 ? " · paid with the following month's salary" : ""}</p>}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Van Salesmen with targets" value={reps.length} icon={ICON.people} />
        <Stat label="Rewards earned so far" value={formatKobo(totalReward)} tone="green" note={totalFull ? `of ${formatKobo(totalFull)} available` : undefined} />
        <Stat label="Goes on payroll for" value={monthLabel(rules?.pay_lag === 1 ? nextMonth(period) : period)} icon={ICON.cash} />
      </div>

      {data.isLoading && <p className="text-sm text-ink-soft">Loading…</p>}
      {data.error && <ErrorNote>{(data.error as Error).message}</ErrorNote>}
      {data.data && reps.length === 0 && (
        <Card><p className="text-sm text-ink-soft">No targets for {monthLabel(period)} yet.{manage ? " Use Set target, or copy last month's." : ""}</p></Card>
      )}

      <div className="space-y-2">
        {reps.map((r) => (
          <Card key={r.user_id}>
            <button type="button" aria-expanded={open === r.user_id} onClick={() => setOpen(open === r.user_id ? null : r.user_id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
              <span className="font-semibold">{r.name} <span className="text-xs font-normal text-ink-soft">{r.targets.length} product{r.targets.length === 1 ? "" : "s"}</span></span>
              <span className="text-sm tabular-nums">Reward <b>{formatKobo(r.reward_total)}</b> <span className="text-ink-soft">of {formatKobo(r.reward_full)}</span></span>
            </button>
            <ul className="mt-3 space-y-3">
              {(open === r.user_id ? r.targets : r.targets.slice(0, 3)).map((t) => <TargetRow key={t.id} t={t} onRemove={manage ? () => { if (window.confirm(`Remove ${r.name}'s ${t.all_products ? "all-products" : t.product} target?`)) remove.mutate(t.id); } : undefined} />)}
              {open !== r.user_id && r.targets.length > 3 && <li className="text-xs text-ink-soft">+ {r.targets.length - 3} more. Tap to see all.</li>}
            </ul>
          </Card>
        ))}
      </div>

      {modal === "target" && rules && <TargetModal rules={rules} period={period} onClose={() => setModal(null)} onDone={() => { setModal(null); void refresh(); }} />}
      {modal === "rules" && rules && <RulesModal rules={rules} onClose={() => setModal(null)} onDone={() => { setModal(null); void refresh(); }} />}
    </>
  );
}

function TargetRow({ t, onRemove }: { t: TargetLine; onRemove?: () => void }) {
  const pct = Math.min(t.percent, 100);
  const tone = t.payout_percent >= 100 ? "bg-emerald-500" : t.payout_percent > 0 ? "bg-amber-500" : "bg-[#f40009]";
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{t.product}</span>
        <span className="text-xs text-ink-soft tabular-nums">{progressText(t)} · <b className="text-ink">{t.percent}%</b></span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={Math.round(t.percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.product} progress`}><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
      <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
        <span>{t.payout_percent > 0 ? <Badge tone={t.payout_percent >= 100 ? "good" : "warn"}>Pays {t.payout_percent}% · {formatKobo(t.reward)}</Badge> : <>No reward yet · {rewardText(t)} at 100%</>}</span>
        {onRemove && <button type="button" onClick={onRemove} className="font-semibold text-[#c23a3a] hover:underline">Remove</button>}
      </div>
    </li>
  );
}

function TargetModal({ rules, period, onClose, onDone }: { rules: TargetRules; period: string; onClose: () => void; onDone: () => void }) {
  const reps = useQuery({ queryKey: ["reps"], queryFn: () => api<Rep[]>("/reps") });
  const [ids, setIds] = useState<number[]>([]);
  const [scope, setScope] = useState<"product" | "all">("product");
  const [product, setProduct] = useState<Product | null>(null);
  const [amount, setAmount] = useState("");
  const [rtype, setRtype] = useState<"flat" | "salary_percent" | "fixed_percent">("flat");
  const [percent, setPercent] = useState("");
  const [base, setBase] = useState("");
  const [unitId, setUnitId] = useState("");
  const [qty, setQty] = useState("");
  const [reward, setReward] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const list = (reps.data ?? []).filter((r) => r.is_active);
  const full = rtype === "flat" ? nairaToKobo(reward) : rtype === "fixed_percent" ? Math.round(nairaToKobo(base) * Number(percent || 0) / 100) : 0;
  const units = (product?.units ?? []).filter((u) => u.is_active);

  const save = useMutation({
    mutationFn: () => api("/targets", { method: "POST", body: {
      period, user_ids: ids, reward_type: rtype,
      ...(scope === "all" ? { all_products: true, target_amount: nairaToKobo(amount) } : { product_id: product!.id, unit_id: Number(unitId), quantity: Number(qty) }),
      ...(rtype === "flat" ? { reward_amount: nairaToKobo(reward) } : { reward_percent: Number(percent) }),
      ...(rtype === "fixed_percent" ? { reward_base: nairaToKobo(base) } : {}),
    } }),
    onSuccess: onDone,
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? { form: [e.message] }) : { form: [e.message] }),
  });

  return (
    <Modal title={`Set a target for ${monthLabel(period)}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium">Van Salesmen</legend>
          <div className="flex flex-wrap gap-2">
            {list.map((r) => {
              const on = ids.includes(r.id);
              return <button key={r.id} type="button" aria-pressed={on} onClick={() => setIds(on ? ids.filter((x) => x !== r.id) : [...ids, r.id])} className={`min-h-9 rounded-full border px-3 text-sm font-medium ${on ? "border-[#f40009] bg-[#ffe9ea] text-[#f40009]" : "border-line bg-white text-ink-soft"}`}>{r.name}</button>;
            })}
            {list.length > 1 && <button type="button" onClick={() => setIds(ids.length === list.length ? [] : list.map((r) => r.id))} className="min-h-9 px-2 text-sm font-semibold text-[#f40009] hover:underline">{ids.length === list.length ? "Clear" : "Everyone"}</button>}
          </div>
          {errors.user_ids && <p className="mt-1 text-xs text-[#c23a3a]">{errors.user_ids[0]}</p>}
        </fieldset>
        <SelectField label="Target applies to" value={scope} onChange={(v) => setScope(v as "product" | "all")} options={[{ value: "product", label: "One product (a quantity)" }, { value: "all", label: "All products together (total sales value)" }]} />
        {scope === "product" ? (
          <>
            <ProductPicker value={product} onChange={(p) => { setProduct(p); setUnitId(String((p?.units.find((u) => !u.is_base) ?? p?.units.find((u) => u.is_base))?.unit_id ?? "")); }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Counted in" value={unitId} onChange={setUnitId} options={[{ value: "", label: product ? "Choose…" : "Pick a product first" }, ...units.map((u) => ({ value: u.unit_id, label: `${u.unit?.name}${u.is_base ? "" : ` (×${u.factor})`}` }))]} error={errors.unit_id?.[0]} />
              <Field label="Target quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} error={errors.quantity?.[0]} required />
            </div>
          </>
        ) : (
          <MoneyField label="Sales target for the month" value={amount} onChange={setAmount} hint="Everything they sell, of any product, less returns, counted in naira." error={errors.target_amount?.[0]} required />
        )}
        <SelectField label="Reward for reaching 100%" value={rtype} onChange={(v) => setRtype(v as typeof rtype)} options={[{ value: "flat", label: "A flat amount" }, { value: "salary_percent", label: "A percentage of their basic salary" }, { value: "fixed_percent", label: "A percentage of a fixed amount" }]} />
        {rtype === "flat" && <MoneyField label="Reward amount" value={reward} onChange={setReward} hint="Paid in full at 100% or more. A smaller share is paid at lower levels (see Reward rules)." error={errors.reward_amount?.[0]} required />}
        {rtype !== "flat" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Percentage" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 10" error={errors.reward_percent?.[0]} required />
            {rtype === "fixed_percent" && <MoneyField label="Of this amount" value={base} onChange={setBase} error={errors.reward_base?.[0]} required />}
            {rtype === "salary_percent" && <p className="self-end pb-2 text-xs text-ink-soft">Taken of each person&apos;s basic salary on the staff list. Someone not on the staff list gets no reward.</p>}
          </div>
        )}
        <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
          <p className="mb-1 font-medium">What they will earn</p>
          <ul className="space-y-0.5 text-ink-soft">
            {[...rules.tiers].sort((a, b) => b.min - a.min).map((t) => (
              <li key={t.min}>{t.min}% of target or more: <b className="text-ink">{rtype === "salary_percent" ? `${(Number(percent || 0) * t.pays / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}% of their salary` : formatKobo(Math.round(full * t.pays / 100))}</b> <span className="text-xs">({t.pays}% of the reward)</span></li>
            ))}
            <li>Below {Math.min(...rules.tiers.map((t) => t.min))}%: nothing</li>
          </ul>
          <p className="mt-1.5 text-xs text-ink-soft">These levels are shared by every target. Change them under <b>Reward rules</b>.</p>
        </div>
        {errors.form && <ErrorNote>{errors.form[0]}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending} disabled={!ids.length || (scope === "product" ? !product || !unitId || !(Number(qty) > 0) : !(nairaToKobo(amount) > 0)) || (rtype === "flat" ? false : !(Number(percent) > 0) || (rtype === "fixed_percent" && !(nairaToKobo(base) > 0)))}>Save target</Button></div>
      </form>
    </Modal>
  );
}

function RulesModal({ rules, onClose, onDone }: { rules: TargetRules; onClose: () => void; onDone: () => void }) {
  const [tiers, setTiers] = useState(rules.tiers.map((t) => ({ min: String(t.min), pays: String(t.pays) })));
  const [lag, setLag] = useState<"0" | "1">(String(rules.pay_lag) as "0" | "1");
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api("/target-rules", { method: "PUT", body: { tiers: tiers.map((t) => ({ min: Number(t.min), pays: Number(t.pays) })), pay_lag: Number(lag) } }),
    onSuccess: onDone,
    onError: (e: Error) => setErr(e.message),
  });
  const valid = tiers.length > 0 && tiers.every((t) => Number(t.min) > 0 && Number(t.pays) > 0);

  return (
    <Modal title="Reward rules" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">Say how much of the reward is paid at each level of the target. Anyone below the lowest level gets nothing. These rules apply to every van salesman and product.</p>
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span>At</span>
              <input aria-label="Achievement percent" inputMode="numeric" value={t.min} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/\D/g, "") } : x)))} className="min-h-10 w-20 rounded-xl border border-line px-3 text-right" />
              <span>% of target or more, pay</span>
              <input aria-label="Share of reward paid" inputMode="numeric" value={t.pays} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, pays: e.target.value.replace(/\D/g, "") } : x)))} className="min-h-10 w-20 rounded-xl border border-line px-3 text-right" />
              <span>% of the reward</span>
              {tiers.length > 1 && <button type="button" aria-label="Remove level" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-red-50"><Svg d={ICON.x} /></button>}
            </div>
          ))}
          {tiers.length < 6 && <button type="button" onClick={() => setTiers([...tiers, { min: "", pays: "" }])} className="text-sm font-semibold text-[#f40009] hover:underline">+ Add a level</button>}
        </div>
        <SelectField label="Add the reward to" value={lag} onChange={(v) => setLag(v as "0" | "1")} options={[{ value: "0", label: "The same month's salary" }, { value: "1", label: "The following month's salary" }]} hint="Choose the following month if you only know the final figures after the month closes." />
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending} disabled={!valid}>Save rules</Button></div>
      </form>
    </Modal>
  );
}
