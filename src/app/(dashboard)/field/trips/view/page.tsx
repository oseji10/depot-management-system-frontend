"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CheckInModal } from "../../../../../components/check-in-modal";
import { IssueStockModal } from "../../../../../components/issue-stock-modal";
import { TripView } from "../../../../../components/trip-view";
import { Badge, Button, ICON, PageHeader, Svg } from "../../../../../components/ui";
import { useSession } from "../../../../../hooks/session";
import { api } from "../../../../../lib/api";
import { formatDateTime } from "../../../../../lib/format";
import type { TripReport } from "../../../../../lib/types";
import { useIdParam } from "../../../../../hooks/id-param";
import { withSuspense } from "../../../../../components/suspense-page";

function TripDetailPage() {
  const id = useIdParam();
  const s = useSession();
  const [dialog, setDialog] = useState<"issue" | "checkin" | null>(null);

  // While the trip is open the page keeps itself fresh, so sales show up as the salesperson makes them.
  const doc = useQuery({
    queryKey: ["trip", id], queryFn: () => api<TripReport>(`/trips/${id}`),
    refetchInterval: (q) => (q.state.data?.trip.status === "open" ? 15_000 : false),
  });

  const r = doc.data;
  if (!r) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  const open = r.trip.status === "open";

  return (
    <>
      <PageHeader
        crumb={<Link href="/field/trips" className="hover:underline">← All trips</Link>}
        title={`${r.trip.number} · ${r.rep.name}`}
        description={`${r.vehicle ? `${r.vehicle.reg_no} · ` : ""}${r.van.name} · started ${formatDateTime(r.trip.opened_at)}${r.trip.closed_at ? ` · checked in ${formatDateTime(r.trip.closed_at)}` : ""}`}
        action={open && s.can("trips.manage") && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDialog("issue")}><Svg d={ICON.plus} /> Top up stock</Button>
            <Button onClick={() => setDialog("checkin")}><Svg d={ICON.check} /> Check in</Button>
          </div>
        )}
      />

      <div className="mb-4 flex items-center gap-2">
        {open ? <Badge tone="good">On the road · updates every few seconds</Badge> : <Badge tone="neutral">Checked in</Badge>}
        {open && r.sync.pending > 0 && <Badge tone="warn">{r.sync.pending} waiting on their phone</Badge>}
        {open && r.sync.issues > 0 && <Link href="/field/issues"><Badge tone="bad">{r.sync.issues} turned down</Badge></Link>}
        {open && r.sync.seen_at && <span className="text-xs text-ink-soft">Phone last seen {formatDateTime(r.sync.seen_at)}</span>}
        {r.rep.phone && <a href={`tel:${r.rep.phone}`} className="text-sm font-medium text-[#f40009] hover:underline">{r.rep.phone}</a>}
      </div>

      <TripView report={r} />

      {dialog === "issue" && <IssueStockModal rep={{ id: r.rep.id, name: r.rep.name }} reps={[{ id: r.rep.id, name: r.rep.name }]} onClose={() => setDialog(null)} />}
      {dialog === "checkin" && <CheckInModal report={r} onClose={() => setDialog(null)} />}
    </>
  );
}

export default withSuspense(TripDetailPage);
