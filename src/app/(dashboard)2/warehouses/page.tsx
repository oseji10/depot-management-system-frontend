"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { Warehouse } from "../../../lib/types";

export default function WarehousesPage() {
  const s = useSession();

  return (
    <CrudPage<Warehouse>
      title="Warehouses"
      noun="warehouse"
      description="Stock is held in warehouses. Every warehouse belongs to one branch."
      endpoint="/warehouses"
      canCreate={s.can("warehouses.create")}
      canEdit={s.can("warehouses.update")}
      initial={{ is_active: true }}
      columns={[
        {
          header: "Warehouse",
          cell: (w) => (
            <span className="font-medium">
              {w.name} {w.is_default && <Badge tone="warn">Default</Badge>}
            </span>
          ),
        },
        { header: "Code", cell: (w) => w.code },
        { header: "Branch", cell: (w) => w.branch?.name ?? "–" },
        { header: "Status", cell: (w) => <StatusBadge active={w.is_active} /> },
      ]}
      fields={[
        { name: "branch_id", label: "Branch", type: "select", required: true, createOnly: true,
          optionsFrom: { endpoint: "/branches", empty: "Select a branch" } },
        { name: "name", label: "Warehouse name", required: true },
        { name: "code", label: "Warehouse code", required: true },
        { name: "is_default", label: "Default warehouse for this branch", type: "checkbox" },
        { name: "is_active", label: "Warehouse is active", type: "checkbox" },
      ]}
    />
  );
}
