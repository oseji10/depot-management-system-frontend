"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { formatKobo } from "../../../lib/format";
import { ACCOUNT_TYPE_LABEL as TYPE_LABEL } from "../../../lib/status";
import type { Account, AccountType } from "../../../lib/types";

const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as AccountType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }));

export default function AccountsPage() {
  const s = useSession();
  const canManage = s.can("accounts.manage");

  return (
    <CrudPage<Account>
      title="Chart of accounts"
      description="Every figure in your reports comes from these accounts. System accounts are used by automatic postings, so they can be renamed but not removed."
      endpoint="/accounts"
      noun="account"
      canCreate={canManage}
      canEdit={canManage}
      initial={{ type: "expense", is_active: true }}
      columns={[
        { header: "Code", cell: (a) => <span className="font-mono text-xs font-semibold">{a.code}</span> },
        {
          header: "Account",
          cell: (a) => (
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {a.name} {a.is_system && <Badge>System</Badge>}
            </span>
          ),
        },
        { header: "Type", cell: (a) => <Badge tone={a.type === "asset" ? "good" : "neutral"}>{TYPE_LABEL[a.type]}</Badge> },
        { header: "Balance", className: "text-right", cell: (a) => <span className="font-medium">{formatKobo(a.balance ?? 0)}</span> },
        { header: "Status", cell: (a) => <StatusBadge active={a.is_active} /> },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, hint: "Up to 10 characters, e.g. 6150." },
        { name: "name", label: "Account name", required: true },
        { name: "type", label: "Type", type: "select", options: TYPE_OPTIONS, required: true, hint: "Cannot change once the account has postings." },
        { name: "is_active", label: "Account is active", type: "checkbox", editOnly: true },
      ]}
    />
  );
}
