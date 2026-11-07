"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, ErrorNote, Field, Modal, PageHeader, TableCard, theadClass, thClass } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatAmount, formatDate, formatDateTime, sourceLabel } from "../../../../lib/format";
import type { JournalEntry } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function JournalDetailPage() {
  const id = useIdParam();
  const s = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");

  const doc = useQuery({ queryKey: ["journal", id], queryFn: () => api<JournalEntry>(`/journals/${id}`) });
  const j = doc.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["journal", id] });
    queryClient.invalidateQueries({ queryKey: ["list", "/journals"] });
  };

  const post = useMutation({ mutationFn: () => api(`/journals/${id}/post`, { method: "POST" }), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: () => api(`/journals/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); router.replace("/journals"); },
  });
  const reverse = useMutation({
    mutationFn: () => api<JournalEntry>(`/journals/${id}/reverse`, { method: "POST", body: { reason } }),
    onSuccess: (rev) => { refresh(); setReversing(false); router.push(`/journals/view?id=${rev.id}`); },
  });

  if (!j) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const debit = j.lines?.reduce((t, l) => t + l.debit, 0) ?? 0;
  const credit = j.lines?.reduce((t, l) => t + l.credit, 0) ?? 0;
  const canReverse = j.status === "posted" && !j.reversed_at && !j.reversal_of_id && s.can("journals.reverse");
  const error = (post.error ?? remove.error) as Error | null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={j.number}
        description={j.memo}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/journals"><Button variant="secondary">All journals</Button></Link>
            {j.status === "draft" && s.can("journals.create") && (
              <Button variant="danger" busy={remove.isPending} onClick={() => remove.mutate()}>Delete draft</Button>
            )}
            {j.status === "draft" && s.can("journals.post") && <Button busy={post.isPending} disabled={debit !== credit} onClick={() => post.mutate()}>Post entry</Button>}
            {canReverse && <Button variant="danger" onClick={() => setReversing(true)}>Reverse</Button>}
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error.message}</ErrorNote></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={j.status === "posted" ? "good" : "warn"}>{j.status === "posted" ? "Posted" : "Draft"}</Badge>
        {j.reversed_at && <Badge tone="bad">Reversed {formatDateTime(j.reversed_at)}</Badge>}
        {j.reversal_of_id && <Link href={`/journals/view?id=${j.reversal_of_id}`}><Badge>Reversal of an earlier entry</Badge></Link>}
      </div>

      <Card className="mb-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-ink-soft">Date</dt><dd className="mt-0.5 font-semibold">{formatDate(j.entry_date)}</dd></div>
          <div><dt className="text-ink-soft">Source</dt><dd className="mt-0.5 font-semibold">{sourceLabel(j.source_type)}</dd></div>
          <div><dt className="text-ink-soft">Created by</dt><dd className="mt-0.5 font-semibold">{j.creator?.name ?? "–"}</dd></div>
          <div><dt className="text-ink-soft">Posted</dt><dd className="mt-0.5 font-semibold">{j.posted_at ? `${formatDateTime(j.posted_at)}${j.poster ? ` by ${j.poster.name}` : ""}` : "Not yet"}</dd></div>
        </dl>
      </Card>

      <TableCard min="32rem">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={`${thClass} px-5`}>Account</th>
            <th scope="col" className={`${thClass} text-right`}>Debit</th>
            <th scope="col" className={`${thClass} text-right`}>Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {j.lines?.map((l) => (
            <tr key={l.id}>
              <td className="px-5 py-3.5">
                <span className="font-mono text-xs font-semibold">{l.account?.code}</span> <span className="font-medium">{l.account?.name}</span>
                {l.memo && <span className="block text-xs text-ink-soft">{l.memo}</span>}
              </td>
              <td className="px-4 py-3.5 text-right">{l.debit ? formatAmount(l.debit) : ""}</td>
              <td className="px-4 py-3.5 text-right">{l.credit ? formatAmount(l.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line bg-[#fff5f5] font-semibold">
          <tr>
            <td className="px-5 py-3.5">Total</td>
            <td className="px-4 py-3.5 text-right">{formatAmount(debit)}</td>
            <td className="px-4 py-3.5 text-right">{formatAmount(credit)}</td>
          </tr>
        </tfoot>
      </TableCard>

      {reversing && (
        <Modal title={`Reverse ${j.number}`} onClose={() => setReversing(false)}>
          <form onSubmit={(e) => { e.preventDefault(); reverse.mutate(); }} className="space-y-4">
            <p className="text-sm text-ink-soft">This books the exact opposite entry today. The original stays on record, marked as reversed.</p>
            <Field label="Why is it being reversed?" value={reason} onChange={(e) => setReason(e.target.value)} required />
            {reverse.error && <ErrorNote>{(reverse.error as Error).message}</ErrorNote>}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setReversing(false)}>Cancel</Button>
              <Button type="submit" variant="danger" busy={reverse.isPending} disabled={!reason.trim()}>Reverse entry</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default withSuspense(JournalDetailPage);
