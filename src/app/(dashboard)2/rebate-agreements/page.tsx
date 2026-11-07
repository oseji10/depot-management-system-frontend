"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Badge, Button, ErrorNote, ICON, PageHeader, Svg, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { METHOD_LABEL } from "../../../lib/status";
import type { Paginated, RebateAgreement } from "../../../lib/types";

export default function RebateAgreementsPage() {
  const s = useSession();
  const queryClient = useQueryClient();
  const canConfigure = s.can("rebates.configure");

  const { data, isLoading, error } = useQuery({ queryKey: ["list", "/rebate-agreements"], queryFn: () => api<Paginated<RebateAgreement>>("/rebate-agreements") });
  const templates = useQuery({
    queryKey: ["rebate-templates"], enabled: canConfigure,
    queryFn: () => api<{ key: string; name: string }[]>("/rebate-agreements/templates"),
  });

  const load = useMutation({
    mutationFn: (key: string) => api("/rebate-agreements/from-template", { method: "POST", body: { template: key, effective_from: new Date().getFullYear() + "-01-01" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", "/rebate-agreements"] }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Rebate agreements"
        description="The rules that turn what you buy from Coca-Cola into a rebate: clusters, tiers and rates. It is all data you control, so a new chart is an edit, not a code change."
        action={canConfigure && <Link href="/rebate-agreements/new"><Button><Svg d={ICON.plus} /> New agreement</Button></Link>}
      />

      {canConfigure && templates.data && templates.data.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ff3b3f]/30 bg-[#fff1f1] p-4">
          <div>
            <p className="text-sm font-semibold">Start from a template</p>
            <p className="text-xs text-ink-soft">Copies a published chart into your own agreement. You can change every rate afterwards.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.data.map((t) => <Button key={t.key} variant="secondary" busy={load.isPending} onClick={() => load.mutate(t.key)}>Load: {t.name}</Button>)}
          </div>
        </div>
      )}
      {load.error && <div className="mb-4"><ErrorNote>{(load.error as Error).message}</ErrorNote></div>}

      <TableCard min="44rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Agreement</th>
            <th scope="col" className={thClass}>Applies</th>
            <th scope="col" className={thClass}>Tier method</th>
            <th scope="col" className={thClass}>Clusters</th>
            <th scope="col" className={thClass}>Status</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isLoading && <TableLoading cols={6} />}
          {error && <TableError cols={6} message={(error as Error).message} />}
          {data?.data.length === 0 && <TableEmpty cols={6} title="No agreements yet" icon={ICON.doc} hint="Load the Coca-Cola chart above, or create your own." />}
          {data?.data.map((a) => (
            <tr key={a.id} className="transition-colors hover:bg-[#fff5f5]">
              <td className="px-5 py-3.5 font-semibold">{a.name}</td>
              <td className="px-4 py-3.5 text-ink-soft">{formatDate(a.effective_from)} {a.effective_to ? `to ${formatDate(a.effective_to)}` : "onward"}</td>
              <td className="px-4 py-3.5">{METHOD_LABEL[a.method]}</td>
              <td className="px-4 py-3.5">{a.clusters_count}</td>
              <td className="px-4 py-3.5"><Badge tone={a.is_active ? "good" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</Badge></td>
              <td className="px-4 py-3.5 text-right">
                <Link href={`/rebate-agreements/view?id=${a.id}`} className="font-semibold text-[#f40009] hover:underline">{canConfigure ? "Open and edit" : "View"}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
