"use client";

import { CrudPage } from "../../../components/crud-page";
import { StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { ProductCategory } from "../../../lib/types";

export default function CategoriesPage() {
  const s = useSession();

  return (
    <CrudPage<ProductCategory>
      title="Categories"
      noun="category"
      description="How you browse and price products: RGB crates, PET, cans, juices and so on. Sub-categories go one level deep."
      endpoint="/product-categories"
      canCreate={s.can("products.manage")}
      canEdit={s.can("products.manage")}
      canDelete={s.can("products.manage")}
      initial={{ is_active: true, sort_order: 0 }}
      columns={[
        { header: "Category", cell: (c) => <span className="font-medium">{c.name}</span> },
        { header: "Parent", cell: (c) => c.parent?.name ?? "–" },
        { header: "Products", cell: (c) => c.products_count ?? 0 },
        { header: "Status", cell: (c) => <StatusBadge active={c.is_active} /> },
      ]}
      fields={[
        { name: "name", label: "Category name", required: true },
        { name: "parent_id", label: "Parent category", type: "select", optionsFrom: { endpoint: "/product-categories", empty: "None (top level)" } },
        { name: "sort_order", label: "Display order", type: "number", hint: "Lower numbers appear first." },
        { name: "is_active", label: "Category is active", type: "checkbox" },
      ]}
    />
  );
}
