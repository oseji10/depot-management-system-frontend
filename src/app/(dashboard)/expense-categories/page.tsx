"use client";

import Link from "next/link";
import { CrudPage } from "../../../components/crud-page";
import { Badge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import type { ExpenseCategory } from "../../../lib/types";

/** What money is spent on (Fuel, Rent, Loading…), each posting to an expense account in the books. */
export default function ExpenseCategoriesPage() {
  const s = useSession();
  const manage = s.can("expenses.manage");

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/expenses" className="font-semibold text-[#f40009] hover:underline">← Expenses</Link></p>
      <CrudPage<ExpenseCategory & { expenses_count?: number }>
        title="Expense categories"
        noun="category"
        description="What money is spent on, e.g. Fuel, Rent, Loading and offloading. Each category posts to an expense account in your books."
        endpoint="/expense-categories"
        canCreate={manage}
        canEdit={manage}
        canDelete={manage}
        initial={{ is_active: true }}
        toForm={(c) => ({ name: c.name, account_id: c.account_id, is_active: c.is_active })}
        columns={[
          { header: "Category", cell: (c) => <span className="font-medium">{c.name}</span> },
          { header: "Posts to", cell: (c) => (c.account ? `${c.account.code} · ${c.account.name}` : "–") },
          { header: "Used", cell: (c) => `${c.expenses_count ?? 0} expense${c.expenses_count === 1 ? "" : "s"}` },
          { header: "Status", cell: (c) => (c.is_active ? <Badge tone="good">In use</Badge> : <Badge tone="neutral">Switched off</Badge>) },
        ]}
        fields={[
          { name: "name", label: "Name", required: true, hint: "e.g. Fuel, Generator diesel, Security." },
          { name: "account_id", label: "Expense account", type: "select", required: true, optionsFrom: { endpoint: "/expense-categories/accounts", empty: "Choose an account" },
            hint: "Where this spending shows in your books. If unsure, choose General Expenses." },
          { name: "is_active", label: "In use (shows when logging an expense)", type: "checkbox" },
        ]}
      />
    </>
  );
}
