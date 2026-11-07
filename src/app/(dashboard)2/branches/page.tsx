"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { Branch } from "../../../lib/types";

export default function BranchesPage() {
  const s = useSession();
  const storeLevel = s.level !== "branch";

  return (
    <CrudPage<Branch>
      title="Branches"
      noun="branch"
      description="Each branch is a physical depot or sales point. Store-level users see every branch; branch-level users see only their own."
      endpoint="/branches"
      canCreate={s.can("branches.create") && storeLevel}
      canEdit={s.can("branches.update")}
      initial={{ is_active: true }}
      columns={[
        {
          header: "Branch",
          cell: (b) => (
            <div>
              <span className="font-medium">{b.name}</span> {b.is_head_office && <Badge tone="warn">Head office</Badge>}
              {s.isPlatform && b.store && <p className="text-xs text-ink-soft">{b.store.name}</p>}
            </div>
          ),
        },
        { header: "Code", cell: (b) => b.code },
        { header: "Location", cell: (b) => [b.city, b.state].filter(Boolean).join(", ") || "–" },
        { header: "Warehouses", cell: (b) => b.warehouses_count ?? 0 },
        { header: "Users", cell: (b) => b.users_count ?? 0 },
        { header: "Status", cell: (b) => <StatusBadge active={b.is_active} /> },
      ]}
      fields={[
        { name: "name", label: "Branch name", required: true },
        { name: "code", label: "Branch code", required: true, hint: "Short and unique within your store, e.g. IKJ." },
        { name: "city", label: "City" },
        { name: "state", label: "State" },
        { name: "address", label: "Address" },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "is_active", label: "Branch is active", type: "checkbox" },
      ]}
    />
  );
}
