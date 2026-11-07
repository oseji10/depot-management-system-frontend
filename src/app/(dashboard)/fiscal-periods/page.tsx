"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, ErrorNote, PageHeader, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass, ICON } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { FiscalPeriod, Paginated } from "../../../lib/types";

export default function FiscalPeriodsPage() {
  const s = useSession();
  const queryClient = useQueryClient();
  const canClose = s.can("periods.close");

  const { data, isLoading, error } = useQuery({ queryKey: ["list", "/fiscal-periods"], queryFn: () => api<Paginated<FiscalPeriod>>("/fiscal-periods") });

  const change = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "close" | "reopen" }) => api(`/fiscal-periods/${id}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", "/fiscal-periods"] }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Accounting periods"
        description="Months are created automatically. Once a month is closed, nothing can be posted into it, so the figures you reported stay put."
      />

      {change.error && <div className="mb-4"><ErrorNote>{(change.error as Error).message}</ErrorNote></div>}

      <TableCard min="36rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={thClass}>Period</th>
            <th scope="col" className={thClass}>Dates</th>
            <th scope="col" className={thClass}>Status</th>
            <th scope="col" className={thClass}>Closed</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isLoading && <TableLoading cols={5} />}
          {error && <TableError cols={5} message={(error as Error).message} />}
          {data?.data.length === 0 && <TableEmpty cols={5} title="No periods yet" icon={ICON.doc} />}
          {data?.data.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-[#fff5f5]">
              <td className="px-4 py-3.5 font-semibold">{new Date(`${p.starts_on}T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</td>
              <td className="px-4 py-3.5 text-ink-soft">{formatDate(p.starts_on)} to {formatDate(p.ends_on)}</td>
              <td className="px-4 py-3.5"><Badge tone={p.status === "open" ? "good" : "neutral"}>{p.status === "open" ? "Open" : "Closed"}</Badge></td>
              <td className="px-4 py-3.5 text-ink-soft">{p.closed_at ? formatDateTime(p.closed_at) : "–"}</td>
              <td className="px-4 py-3.5 text-right">
                {canClose && (
                  <Button variant="secondary" busy={change.isPending && change.variables?.id === p.id}
                    onClick={() => change.mutate({ id: p.id, action: p.status === "open" ? "close" : "reopen" })}>
                    {p.status === "open" ? "Close period" : "Reopen"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
