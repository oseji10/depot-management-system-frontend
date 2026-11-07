"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Badge, Button, Card, ErrorNote, Field, FilterSelect, ICON, Modal, PageHeader, Pager, SelectField, Svg, TableCard, TableEmpty,
  TableError, TableLoading, Toolbar, theadClass, thClass,
} from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatDate, formatKobo } from "../../../lib/format";
import { REBATE_LABEL, REBATE_TONE } from "../../../lib/status";
import type { Paginated, RebateAgreement, RebateCalculation, RebateProgress } from "../../../lib/types";

const monthLabel = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
const cases = (n: number) => new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(n);

export default function RebatesPage() {
  const s = useSession();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [calculating, setCalculating] = useState(false);

  const list = useQuery({
    queryKey: ["list", "/rebate-calculations", page, status],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (status) q.set("status", status);
      return api<Paginated<RebateCalculation>>(`/rebate-calculations?${q}`);
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Rebates"
        description="Your earnings from Coca-Cola. Each month is calculated from the goods you received, then approved, booked and settled."
        action={s.can("rebates.calculate") && <Button onClick={() => setCalculating(true)}><Svg d={ICON.plus} /> Calculate a month</Button>}
      />

      <Progress />

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Monthly calculations</h2>
      <Toolbar>
        <FilterSelect id="rb-status" label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.entries(REBATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </FilterSelect>
        {list.data && <span className="ml-auto pr-1 text-sm text-ink-soft">{list.data.total} calculation{list.data.total === 1 ? "" : "s"}</span>}
      </Toolbar>

      <TableCard min="44rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Month</th>
            <th scope="col" className={thClass}>Cluster</th>
            <th scope="col" className={`${thClass} text-right`}>Eligible purchases</th>
            <th scope="col" className={`${thClass} text-right`}>Rebate</th>
            <th scope="col" className={thClass}>Status</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.isLoading && <TableLoading cols={6} />}
          {list.error && <TableError cols={6} message={(list.error as Error).message} />}
          {list.data?.data.length === 0 && <TableEmpty cols={6} title="Nothing calculated yet" icon={ICON.doc} hint="Press Calculate a month once the month's deliveries are posted." />}
          {list.data?.data.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-[#fff5f5]">
              <td className="px-5 py-3.5"><span className="font-semibold">{monthLabel(c.period_start)}</span><span className="block font-mono text-xs text-ink-soft">{c.number}</span></td>
              <td className="px-4 py-3.5">{c.cluster_name} {c.cluster_overridden && <Badge tone="warn">Overridden</Badge>}</td>
              <td className="px-4 py-3.5 text-right">{formatKobo(c.total_eligible_value)}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{formatKobo(c.total_rebate)}</td>
              <td className="px-4 py-3.5"><Badge tone={REBATE_TONE[c.status]}>{REBATE_LABEL[c.status]}</Badge></td>
              <td className="px-4 py-3.5 text-right"><Link href={`/rebates/view?id=${c.id}`} className="font-semibold text-[#f40009] hover:underline">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {list.data && <Pager page={page} last={list.data.last_page} total={list.data.total} current={list.data.current_page} setPage={setPage} />}

      {calculating && <CalculateModal onClose={() => setCalculating(false)} />}
    </div>
  );
}

function Progress() {
  const progress = useQuery({ queryKey: ["rebate-progress"], retry: false, queryFn: () => api<RebateProgress>("/rebates/progress") });

  if (progress.error) {
    return (
      <Card>
        <p className="text-sm">{(progress.error as Error).message}</p>
        <p className="mt-1 text-sm"><Link href="/rebate-agreements" className="font-semibold text-[#f40009] hover:underline">Go to rebate agreements</Link></p>
      </Card>
    );
  }

  if (!progress.data) return <div className="h-40 animate-pulse rounded-2xl bg-line" />;
  const p = progress.data;

  return (
    <Card title={`This month so far · ${monthLabel(`${p.month}-01`)}`} action={<Badge tone="good">{p.cluster} cluster</Badge>}>
      <p className="mb-4 text-sm text-ink-soft">
        Cluster comes from {cases(p.cluster_volume)} cases bought between {formatDate(p.cluster_from)} and {formatDate(p.cluster_to)}. Agreement: {p.agreement.name}.
        This is an estimate until the month is calculated and approved.
      </p>

      {p.lines.length === 0 ? (
        <p className="text-sm text-ink-soft">No eligible goods received yet this month.</p>
      ) : (
        <div className="space-y-3">
          {p.lines.map((l) => {
            const target = l.next_tier_from ?? null;
            const pct = target ? Math.min(100, (l.cases / target) * 100) : 100;
            return (
              <div key={l.rebate_category_id} className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{l.category_name}</p>
                  <p className="text-sm"><span className="font-semibold">{cases(l.cases)}</span> cases · <span className="font-semibold text-[#f40009]">{l.no_tier ? "no tier yet" : `${l.tier_rate}%`}</span> · {formatKobo(l.rebate)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.category_name} progress to next tier`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff3b3f] to-[#f40009]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {l.cases_to_next_tier ? `${cases(l.cases_to_next_tier)} more cases to reach ${l.next_tier_rate}%` : "Top tier reached"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
        <span className="text-ink-soft">Estimated rebate on {formatKobo(p.total_eligible_value)} of purchases</span>
        <span className="font-bold">{formatKobo(p.total_rebate)}</span>
      </div>
    </Card>
  );
}

function CalculateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [cluster, setCluster] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const agreement = useQuery({
    queryKey: ["rebate-active-agreement"],
    queryFn: async () => {
      const list = await api<Paginated<RebateAgreement>>("/rebate-agreements");
      const first = list.data.find((a) => a.is_active);
      return first ? api<RebateAgreement>(`/rebate-agreements/${first.id}`) : null;
    },
  });

  const run = useMutation({
    mutationFn: () => api<RebateCalculation>("/rebate-calculations", { method: "POST", body: { month, cluster_name: cluster || null, override_reason: cluster ? reason : null } }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["list", "/rebate-calculations"] });
      queryClient.invalidateQueries({ queryKey: ["rebate-progress"] });
      router.push(`/rebates/view?id=${c.id}`);
    },
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}),
  });

  return (
    <Modal title="Calculate a month" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); run.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">Uses accepted goods on posted Coca-Cola receipts in that month. Calculating a month that is still a draft replaces the draft.</p>
        <Field label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} error={errors.month?.[0]} required />

        <SelectField label="Cluster" value={cluster} onChange={setCluster}
          options={[{ value: "", label: "Work it out from last quarter's volume" }, ...(agreement.data?.clusters ?? []).map((c) => ({ value: c.name, label: `Override: ${c.name}` }))]}
          hint="Only override when Coca-Cola has confirmed a different cluster." />
        {cluster && <Field label="Why override?" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.override_reason?.[0]} required />}

        {run.error && !Object.keys(errors).length && <ErrorNote>{(run.error as Error).message}</ErrorNote>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={run.isPending} disabled={!month || (!!cluster && !reason.trim())}>Calculate</Button>
        </div>
      </form>
    </Modal>
  );
}
