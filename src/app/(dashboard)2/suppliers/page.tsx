"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { Supplier } from "../../../lib/types";

export default function SuppliersPage() {
  const s = useSession();

  return (
    <CrudPage<Supplier>
      title="Suppliers"
      noun="supplier"
      description="Who you buy from. Mark Coca-Cola as the manufacturer: its goods receipts are what monthly rebates are calculated from."
      endpoint="/suppliers"
      canCreate={s.can("purchasing.manage")}
      canEdit={s.can("purchasing.manage")}
      initial={{ is_active: true, payment_terms_days: 0 }}
      columns={[
        {
          header: "Supplier",
          cell: (x) => <span className="font-medium">{x.name} {x.is_manufacturer && <Badge tone="warn">Manufacturer</Badge>}</span>,
        },
        { header: "Code", cell: (x) => x.code },
        { header: "Contact", cell: (x) => [x.contact_name, x.phone].filter(Boolean).join(" · ") || "–" },
        { header: "Payment terms", cell: (x) => (x.payment_terms_days ? `${x.payment_terms_days} days` : "On delivery") },
        { header: "Status", cell: (x) => <StatusBadge active={x.is_active} /> },
      ]}
      fields={[
        { name: "name", label: "Supplier name", required: true },
        { name: "code", label: "Code", required: true, hint: "Short and unique, e.g. CCB." },
        { name: "contact_name", label: "Contact person" },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "address", label: "Address" },
        { name: "payment_terms_days", label: "Payment terms (days)", type: "number", hint: "0 means paid on delivery." },
        { name: "is_manufacturer", label: "This is the manufacturer (Coca-Cola)", type: "checkbox" },
        { name: "is_active", label: "Supplier is active", type: "checkbox" },
      ]}
    />
  );
}
