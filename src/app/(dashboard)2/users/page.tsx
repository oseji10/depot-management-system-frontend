"use client";

import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { formatDateTime } from "../../../lib/format";
import type { AppUser } from "../../../lib/types";

export default function UsersPage() {
  const s = useSession();

  return (
    <CrudPage<AppUser>
      title="Users"
      noun="user"
      description="Assign each person to a branch, or leave the branch empty to give them access to the whole store."
      endpoint="/users"
      canCreate={s.can("users.create")}
      canEdit={s.can("users.update")}
      initial={{ is_active: true }}
      toForm={(u) => ({
        name: u.name, phone: u.phone ?? "", password: "", is_active: u.is_active,
        role_id: u.role?.id ?? "", branch_id: u.branch_id ?? "",
      })}
      columns={[
        {
          header: "User",
          cell: (u) => (
            <div>
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-ink-soft">{u.email}</p>
            </div>
          ),
        },
        { header: "Role", cell: (u) => u.role?.name ?? <span className="text-ink-soft">None</span> },
        {
          header: "Access",
          cell: (u) =>
            u.branch ? u.branch.name : <Badge tone="neutral">All branches</Badge>,
        },
        ...(s.isPlatform ? [{ header: "Store", cell: (u: AppUser) => u.store?.name ?? "Platform" }] : []),
        { header: "Last sign-in", cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : "Never") },
        { header: "Status", cell: (u) => <StatusBadge active={u.is_active} /> },
      ]}
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true, createOnly: true },
        { name: "phone", label: "Phone" },
        { name: "password", label: "Password", type: "password", required: true, hint: "At least 8 characters. Leave blank when editing to keep the current one." },
        { name: "role_id", label: "Role", type: "select", required: true,
          optionsFrom: { endpoint: "/roles", empty: "Select a role" } },
        { name: "branch_id", label: "Branch", type: "select",
          hint: s.level === "branch" ? "New users are placed in your branch." : undefined,
          optionsFrom: { endpoint: "/branches", empty: "All branches (whole store)" } },
        { name: "is_active", label: "User can sign in", type: "checkbox" },
      ]}
    />
  );
}
