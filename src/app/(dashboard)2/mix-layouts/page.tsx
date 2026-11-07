"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { MixLayout } from "../../../lib/types";

export default function MixLayoutsPage() {
  const s = useSession();

  return (
    <CrudPage<MixLayout>
      title="Mixed crates"
      noun="layout"
      description="Ways to share one crate between products at the till, e.g. a crate of 24 as 4 rows of 6, or 6 rows of 4. Each row is one product, and only products with the same price can be mixed."
      endpoint="/mix-layouts"
      initial={{ is_active: true }}
      canCreate={s.can("products.manage")}
      canEdit={s.can("products.manage")}
      columns={[
        { header: "Name", cell: (l) => <span className="font-medium">{l.name}</span> },
        { header: "Rows", cell: (l) => `${l.row_count} rows of ${l.row_size}` },
        { header: "Bottles per crate", cell: (l) => l.units },
        { header: "Status", cell: (l) => <Badge tone={l.is_active ? "good" : "neutral"}>{l.is_active ? "In use" : "Off"}</Badge> },
      ]}
      fields={[
        { name: "name", label: "Name", required: true, hint: "Shown on the till and the receipt, e.g. 4 × 6." },
        { name: "row_count", label: "Number of rows", type: "number", required: true },
        { name: "row_size", label: "Bottles in each row", type: "number", required: true },
        { name: "is_active", label: "In use", type: "checkbox" },
      ]}
    />
  );
}
