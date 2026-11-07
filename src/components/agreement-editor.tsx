"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOptions } from "../hooks/options";
import { ApiError, api } from "../lib/api";
import { METHOD_LABEL, TREATMENT_LABEL } from "../lib/status";
import type { RebateAgreement } from "../lib/types";
import { Button, Card, ErrorNote, Field, ICON, SectionTitle, SelectField, Svg, inputClass } from "./ui";

type TierRow = { from: string; rate: string };
type ClusterForm = { name: string; above: string; tiers: Record<string, TierRow[]> };

const toForm = (a?: RebateAgreement | null): ClusterForm[] =>
  (a?.clusters ?? [{ name: "Standard", volume_above: null, tiers: [] }]).map((c) => {
    const tiers: Record<string, TierRow[]> = {};
    for (const t of [...c.tiers].sort((x, y) => x.from_cases - y.from_cases)) {
      (tiers[String(t.rebate_category_id)] ??= []).push({ from: String(t.from_cases), rate: String(t.rate) });
    }
    return { name: c.name, above: c.volume_above === null ? "" : String(c.volume_above), tiers };
  });

const num = (v: string) => v.replace(/[^\d.]/g, "");
const int = (v: string) => v.replace(/\D/g, "");

export function AgreementEditor({ agreement }: { agreement?: RebateAgreement }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useOptions("/rebate-categories");

  const [name, setName] = useState(agreement?.name ?? "");
  const [from, setFrom] = useState(agreement?.effective_from ?? new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(agreement?.effective_to ?? "");
  const [method, setMethod] = useState<string>(agreement?.method ?? "all_units");
  const [treatment, setTreatment] = useState<string>(agreement?.accounting_treatment ?? "income");
  const [active, setActive] = useState(agreement?.is_active ?? true);
  const [note, setNote] = useState(agreement?.note ?? "");
  const [clusters, setClusters] = useState<ClusterForm[]>(() => toForm(agreement));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const patchCluster = (i: number, p: Partial<ClusterForm>) => setClusters((cur) => cur.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  const patchTier = (i: number, cat: string, j: number, p: Partial<TierRow>) =>
    setClusters((cur) => cur.map((c, idx) => (idx !== i ? c : { ...c, tiers: { ...c.tiers, [cat]: c.tiers[cat].map((t, k) => (k === j ? { ...t, ...p } : t)) } })));
  const addTier = (i: number, cat: string) =>
    setClusters((cur) => cur.map((c, idx) => (idx !== i ? c : { ...c, tiers: { ...c.tiers, [cat]: [...(c.tiers[cat] ?? []), { from: "", rate: "" }] } })));
  const removeTier = (i: number, cat: string, j: number) =>
    setClusters((cur) => cur.map((c, idx) => (idx !== i ? c : { ...c, tiers: { ...c.tiers, [cat]: c.tiers[cat].filter((_, k) => k !== j) } })));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name, effective_from: from, effective_to: to || null, method, accounting_treatment: treatment, is_active: active, note: note || null,
        clusters: clusters.map((c) => ({
          name: c.name,
          volume_above: c.above === "" ? null : Number(c.above),
          tiers: Object.entries(c.tiers).flatMap(([cat, rows]) =>
            rows.filter((r) => r.from !== "" && r.rate !== "").map((r) => ({ rebate_category_id: Number(cat), from_cases: Number(r.from), rate: Number(r.rate) }))),
        })),
      };
      return agreement ? api<RebateAgreement>(`/rebate-agreements/${agreement.id}`, { method: "PUT", body }) : api<RebateAgreement>("/rebate-agreements", { method: "POST", body });
    },
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ["list", "/rebate-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["agreement", String(a.id)] });
      router.replace("/rebate-agreements");
    },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  const baseCount = clusters.filter((c) => c.above === "").length;

  return (
    <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-5">
      <Card>
        <SectionTitle n="1" title="Agreement" hint="Which months it covers and how it is paid." />
        <div className="space-y-4">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} placeholder="Coca-Cola wholesaler rebate 2026" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Applies from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} error={errors.effective_from?.[0]} required />
            <Field label="Applies until (optional)" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={errors.effective_to?.[0]} hint="Leave empty while it is still running." />
            <SelectField label="How tiers pay" value={method} onChange={setMethod} error={errors.method?.[0]}
              options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
              hint="Check your signed agreement. Most reach a tier and the rate covers the whole month." />
            <SelectField label="How it is booked" value={treatment} onChange={setTreatment} error={errors.accounting_treatment?.[0]}
              options={Object.entries(TREATMENT_LABEL).map(([value, label]) => ({ value, label }))}
              hint="Ask your accountant. This decides where the earned rebate shows in your reports." />
          </div>
          <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3.5 text-sm transition hover:border-[#ff3b3f]/40 has-[:checked]:border-[#ff3b3f]/50 has-[:checked]:bg-[#fff1f1]">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#f40009]" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span><span className="block font-semibold">Agreement is active</span><span className="text-xs text-ink-soft">Used when calculating months it covers.</span></span>
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle n="2" title="Clusters and tiers"
          hint="A cluster is decided by last quarter's total volume. Within it, each product group has its own tiers by monthly cases." />

        {errors.clusters?.[0] && <div className="mb-3"><ErrorNote>{errors.clusters[0]}</ErrorNote></div>}
        {baseCount !== 1 && <p className="mb-3 text-xs text-[#c23a3a]">Exactly one cluster must have no threshold. It is the starting cluster, such as Standard.</p>}

        <div className="space-y-5">
          {clusters.map((c, i) => (
            <div key={i} className="rounded-2xl border border-line bg-[#fffafa] p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
                <Field label="Cluster name" value={c.name} onChange={(e) => patchCluster(i, { name: e.target.value })} error={errors[`clusters.${i}.name`]?.[0]} />
                <Field label="Last quarter volume above" inputMode="numeric" value={c.above} onChange={(e) => patchCluster(i, { above: int(e.target.value) })}
                  placeholder="Starting cluster" error={errors[`clusters.${i}.volume_above`]?.[0]} hint="Physical cases. Empty = starting cluster." />
                {clusters.length > 1 && (
                  <button type="button" onClick={() => setClusters((cur) => cur.filter((_, idx) => idx !== i))}
                    className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#c23a3a] transition hover:bg-red-50">Remove cluster</button>
                )}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {categories.map((cat) => {
                  const key = String(cat.value);
                  const rows = c.tiers[key] ?? [];
                  return (
                    <div key={key} className="rounded-xl border border-line bg-white p-3.5">
                      <p className="mb-2 text-sm font-semibold">{cat.label}</p>
                      {rows.length === 0 && <p className="mb-2 text-xs text-ink-soft">No tiers. This group earns no rebate in this cluster.</p>}
                      <div className="space-y-2">
                        {rows.map((r, j) => (
                          <div key={j} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-ink-soft">
                              <span className="shrink-0">From</span>
                              <input inputMode="numeric" aria-label={`${cat.label} tier ${j + 1} from cases`} value={r.from} onChange={(e) => patchTier(i, key, j, { from: int(e.target.value) })} className={`${inputClass} min-h-10 text-right`} />
                              <span className="shrink-0">cases</span>
                            </label>
                            <label className="flex items-center gap-1 text-xs text-ink-soft">
                              <input inputMode="decimal" aria-label={`${cat.label} tier ${j + 1} rate`} value={r.rate} onChange={(e) => patchTier(i, key, j, { rate: num(e.target.value) })} className={`${inputClass} min-h-10 text-right`} />%
                            </label>
                            <button type="button" aria-label="Remove tier" onClick={() => removeTier(i, key, j)} className="grid size-8 place-items-center rounded-lg text-[#c23a3a] hover:bg-red-50"><Svg d={ICON.x} /></button>
                          </div>
                        ))}
                      </div>
                      {(errors[`clusters.${i}.tiers`]?.[0]) && <p className="mt-1 text-xs text-[#c23a3a]">{errors[`clusters.${i}.tiers`][0]}</p>}
                      <button type="button" onClick={() => addTier(i, key)} className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#f40009] hover:bg-[#ffe9ea]"><Svg d={ICON.plus} className="size-3.5" /> Add tier</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" className="mt-4" onClick={() => setClusters((cur) => [...cur, { name: "", above: "", tiers: {} }])}>
          <Svg d={ICON.plus} /> Add a cluster
        </Button>
        <p className="mt-3 text-xs text-ink-soft">A tier starting at 0 is the fixed rate. A group with no tier at 0 earns nothing until it reaches its first tier.</p>
      </Card>

      {formError && !Object.keys(errors).length && <ErrorNote>{formError}</ErrorNote>}

      <div className="flex justify-end gap-2">
        <Link href="/rebate-agreements"><Button type="button" variant="secondary">Cancel</Button></Link>
        <Button type="submit" busy={save.isPending}>{agreement ? "Save changes" : "Create agreement"}</Button>
      </div>
    </form>
  );
}
