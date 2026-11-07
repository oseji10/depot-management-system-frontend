"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge } from "../../../components/ui";
import { formatDateTime } from "../../../lib/format";
import type { AuditEntry } from "../../../lib/types";

const tone = (e: string) => (e === "deleted" || e === "login_failed" ? "bad" : e === "created" ? "good" : "neutral");

export default function AuditLogPage() {
  return (
    <CrudPage<AuditEntry>
      title="Audit log"
      noun="entry"
      description="A permanent record of who changed what, and when. Entries cannot be edited or removed."
      endpoint="/audit-logs"
      searchable={false}
      empty="Nothing has been recorded yet."
      columns={[
        { header: "When", cell: (a) => formatDateTime(a.created_at) },
        { header: "Who", cell: (a) => a.user?.name ?? "System" },
        { header: "Event", cell: (a) => <Badge tone={tone(a.event)}>{a.event.replace("_", " ")}</Badge> },
        {
          header: "Record",
          cell: (a) => (a.auditable_type ? `${a.auditable_type.split("\\").pop()} #${a.auditable_id}` : "–"),
        },
        {
          header: "Fields",
          cell: (a) => <span className="text-ink-soft">{a.new_values ? Object.keys(a.new_values).join(", ") : "–"}</span>,
        },
        { header: "IP", cell: (a) => a.ip_address ?? "–" },
      ]}
      fields={[]}
    />
  );
}
