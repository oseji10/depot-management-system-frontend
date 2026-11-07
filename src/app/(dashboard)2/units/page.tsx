"use client";

import { CrudPage } from "../../../components/crud-page";
import { useSession } from "../../../hooks/session";
import type { Unit } from "../../../lib/types";

export default function UnitsPage() {
  const s = useSession();

  return (
    <CrudPage<Unit>
      title="Units"
      noun="unit"
      description="The ways products are counted and sold: bottles, cans, crates, cases. How many bottles are in a crate is set on each product."
      endpoint="/units"
      canCreate={s.can("products.manage")}
      canEdit={s.can("products.manage")}
      columns={[
        { header: "Unit", cell: (u) => <span className="font-medium">{u.name}</span> },
        { header: "Abbreviation", cell: (u) => u.abbreviation },
      ]}
      fields={[
        { name: "name", label: "Unit name", required: true },
        { name: "abbreviation", label: "Abbreviation", required: true, hint: "Short and unique, e.g. CRT." },
      ]}
    />
  );
}
