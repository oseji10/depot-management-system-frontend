"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { Unit } from "../../../lib/types";

/** The list of variation names (Bottle, Can, Crate, Half crate…) every product picks from. */
export default function VariationsPage() {
  const s = useSession();

  return (
    <CrudPage<Unit>
      title="Variations"
      noun="variation"
      description="The ways your products are sold: Bottle, Can, Crate, Half crate, Pack… Create them here or while adding a product; both lists are the same. Each product uses these quantities, and you can adjust them per product if needed."
      endpoint="/units"
      canCreate={s.can("products.manage")}
      canEdit={s.can("products.manage")}
      canDelete={s.can("products.manage")}
      columns={[
        { header: "Variation", cell: (u) => <span className="font-medium">{u.name}</span> },
        { header: "Quantity in this variation", cell: (u) => (u.usual_size && u.usual_size > 1 ? `${u.usual_size}` : <Badge tone="neutral">Single item</Badge>) },
        { header: "Used by", cell: (u) => `${u.products_count ?? 0} product${u.products_count === 1 ? "" : "s"}` },
      ]}
      fields={[
        { name: "name", label: "Name", required: true, hint: "e.g. Bottle, Plastic bottle, Can, Crate, Half crate, Pack of 6." },
        { name: "usual_size", label: "Quantity in this variation", type: "number", hint: "How many single items are in it, e.g. 24 for a crate. Leave empty for a single item like Bottle or Can." },
        { name: "abbreviation", label: "Short code (optional)", hint: "Made for you if left empty." },
      ]}
    />
  );
}
