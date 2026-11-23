"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CrudPage } from "../../../components/crud-page";
import { AddVariationsModal } from "../../../components/product-variations";
import { Button } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { Unit } from "../../../lib/types";

/** The list of variation names (Bottle, Can, Crate, Half crate…) every product picks from. */
export default function VariationsPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  return (
    <>
    <CrudPage<Unit>
      title="Variations"
      noun="variation"
      description="The ways your products are sold, e.g. Full crate, Half crate, Pack. Add them here or while adding a product; both use the same list."
      endpoint="/units"
      canCreate={s.can("products.manage")}
      createAction={s.can("products.manage") ? <Button onClick={() => setAdding(true)}>Add variation</Button> : null}
      canEdit={s.can("products.manage")}
      canDelete={s.can("products.manage")}
      columns={[
        { header: "Variation", cell: (u) => <span className="font-medium">{u.name}</span> },
        { header: "Value", cell: (u) => u.value ?? <span className="text-ink-soft">–</span> },
        { header: "Quantity", cell: (u) => (u.usual_size ? `${u.usual_size}` : <span className="text-ink-soft">–</span>) },
        { header: "Used by", cell: (u) => `${u.products_count ?? 0} product${u.products_count === 1 ? "" : "s"}` },
      ]}
      fields={[
        { name: "name", label: "Name", required: true, hint: "e.g. Bottle, Plastic bottle, Can, Crate, Half crate, Pack of 6." },
        { name: "value", label: "Value (optional)", hint: "Any text, e.g. 24 bottles." },
        { name: "usual_size", label: "Quantity (optional)", type: "number" },
        { name: "abbreviation", label: "Short code (optional)", hint: "Made for you if left empty." },
      ]}
    />
      {adding && <AddVariationsModal onClose={() => setAdding(false)} onCreated={() => { setAdding(false); void qc.invalidateQueries({ queryKey: ["list", "/units"] }); }} />}
    </>
  );
}
