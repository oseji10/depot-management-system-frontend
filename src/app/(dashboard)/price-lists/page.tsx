"use client";

import Link from "next/link";
import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { formatDate } from "../../../lib/format";
import type { PriceList } from "../../../lib/types";

export default function PriceListsPage() {
  const s = useSession();

  return (
    <CrudPage<PriceList>
      title="Price lists"
      noun="price list"
      description="One default standard list holds your everyday prices. Promotions sit on top of it for a date range and win while they are running."
      endpoint="/price-lists"
      canCreate={s.can("pricing.manage")}
      canEdit={s.can("pricing.manage")}
      canDelete={s.can("pricing.manage")}
      initial={{ type: "promo", priority: 10, is_active: true }}
      columns={[
        {
          header: "Price list",
          cell: (l) => (
            <span className="font-medium">
              {l.name} {l.is_default && <Badge tone="warn">Default</Badge>}
            </span>
          ),
        },
        { header: "Type", cell: (l) => (l.type === "promo" ? "Promotion" : "Standard") },
        {
          header: "Runs",
          cell: (l) =>
            l.type === "promo" && l.starts_on
              ? `${formatDate(l.starts_on)} – ${l.ends_on ? formatDate(l.ends_on) : "no end date"}`
              : "Always",
        },
        { header: "Prices", cell: (l) => l.prices_count ?? 0 },
        { header: "Status", cell: (l) => <StatusBadge active={l.is_active} /> },
        {
          header: "",
          className: "text-right",
          cell: (l) => (
            <Link href={`/price-lists/view?id=${l.id}`} className="font-semibold text-[#f40009] hover:underline">
              {s.can("pricing.manage") ? "Edit prices" : "View prices"}
            </Link>
          ),
        },
      ]}
      fields={[
        { name: "name", label: "Name", required: true },
        {
          name: "type", label: "Type", type: "select", required: true,
          options: [{ value: "standard", label: "Standard" }, { value: "promo", label: "Promotion" }],
        },
        { name: "starts_on", label: "Starts on", type: "date", hint: "Promotions only." },
        { name: "ends_on", label: "Ends on", type: "date", hint: "Promotions only. Leave empty for no end date." },
        { name: "priority", label: "Priority", type: "number", hint: "When promotions overlap, the higher number wins." },
        { name: "is_default", label: "Use as the default standard list", type: "checkbox" },
        { name: "is_active", label: "Price list is active", type: "checkbox" },
      ]}
    />
  );
}
