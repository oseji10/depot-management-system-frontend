"use client";

import { CrudPage } from "../../../components/crud-page";
import { StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { RebateCategory } from "../../../lib/types";

export default function RebateCategoriesPage() {
  const s = useSession();

  return (
    <CrudPage<RebateCategory>
      title="Rebate categories"
      noun="rebate category"
      description="The groups Coca-Cola uses to add up your monthly volume for rebates. Each product belongs to one. Rates and tiers are configured with the rebate module."
      endpoint="/rebate-categories"
      canCreate={s.can("products.manage")}
      canEdit={s.can("products.manage")}
      canDelete={s.can("products.manage")}
      searchable={false}
      initial={{ is_active: true, sort_order: 0 }}
      columns={[
        { header: "Category", cell: (c) => <span className="font-medium">{c.name}</span> },
        { header: "Code", cell: (c) => <code className="text-xs">{c.code}</code> },
        { header: "Products", cell: (c) => c.products_count ?? 0 },
        { header: "Status", cell: (c) => <StatusBadge active={c.is_active} /> },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, createOnly: true, hint: "Letters, numbers and underscores. Cannot be changed later." },
        { name: "name", label: "Name", required: true },
        { name: "sort_order", label: "Display order", type: "number" },
        { name: "is_active", label: "Category is active", type: "checkbox", editOnly: true },
      ]}
    />
  );
}
