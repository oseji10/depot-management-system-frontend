"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, ErrorNote, ICON, PageHeader, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";

type Batch = {
  id: number; kind: "customers" | "products" | "orders"; file_name: string | null; rows_total: number; rows_sent: number; counts: Record<string, number> | null; problems: number;
  status: "active" | "undone"; undone_at: string | null; undo_note: string | null; created_at: string; user?: { name: string }; can_undo: boolean;
};

const KIND = { customers: "Customers", products: "Products", orders: "Past orders" } as const;
const COUNT_LABEL: Record<string, string> = { customers_created: "customers added", customers_existing: "customers already there", products_created: "products added", orders_created: "orders added", orders_existing: "orders already there", created: "added", skipped: "skipped" };

export default function ImportHistoryPage() {
  const s = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["import-batches"], queryFn: () => api<{ data: Batch[] }>("/import-batches") });
  const undo = useMutation({ mutationFn: (id: number) => api(`/import-batches/${id}/undo`, { method: "POST" }), onSuccess: () => qc.invalidateQueries() });

  return (
    <div>
      <PageHeader title="Upload history" description="Every Excel upload: who did it, when, and what it changed. Customers and past orders can be taken back out." />
      {undo.error && <div className="mb-3"><ErrorNote>{(undo.error as Error).message}</ErrorNote></div>}
      <TableCard min="48rem">
        <thead className={theadClass}><tr><th scope="col" className={`${thClass} px-5`}>Upload</th><th scope="col" className={thClass}>By</th><th scope="col" className={thClass}>What it did</th><th scope="col" className={`${thClass} text-right`}>Action</th></tr></thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={4} />}
          {q.error && <TableError cols={4} message={(q.error as Error).message} />}
          {q.data && q.data.data.length === 0 && <TableEmpty cols={4} title="No uploads yet" hint="Uploads made from now on are recorded here." icon={ICON.doc} />}
          {q.data?.data.map((b) => (
            <tr key={b.id}>
              <td className="px-5 py-3.5"><span className="font-semibold">{KIND[b.kind]}</span> <span className="text-ink-soft">{b.file_name}</span><span className="block text-xs text-ink-soft">{formatDateTime(b.created_at)} · {b.rows_sent} of {b.rows_total} rows</span></td>
              <td className="px-4 py-3.5">{b.user?.name}</td>
              <td className="px-4 py-3.5 text-xs text-ink-soft">
                {Object.entries(b.counts ?? {}).filter(([k, v]) => v && k !== "problems").map(([k, v]) => <span key={k} className="block">{v.toLocaleString()} {COUNT_LABEL[k] ?? k.replace(/_/g, " ")}</span>)}
                {b.problems > 0 && <span className="block text-[#c23a3a]">{b.problems} rows had problems</span>}
                {b.status === "undone" && <Badge tone="bad">Undone</Badge>} {b.undo_note}
              </td>
              <td className="px-4 py-3.5 text-right">
                {b.can_undo && s.can("sales.import") && <Button size="sm" variant="danger" busy={undo.isPending && undo.variables === b.id} onClick={() => { if (confirm("Take this upload back out? Orders it added are deleted, and customers it added are removed if nothing else uses them.")) undo.mutate(b.id); }}>Undo</Button>}
                {b.kind === "products" && b.status === "active" && <span className="text-xs text-ink-soft">Not undoable</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
