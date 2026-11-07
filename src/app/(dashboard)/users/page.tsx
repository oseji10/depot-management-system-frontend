"use client";

import { useMutation } from "@tanstack/react-query";
import { CrudPage } from "../../../components/crud-page";
import { Badge, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import type { AppUser } from "../../../lib/types";

/** Emails the person a link to set a new password. */
function ResetButton({ user }: { user: AppUser }) {
  const send = useMutation({ mutationFn: () => api<{ message: string }>(`/users/${user.id}/send-reset`, { method: "POST" }) });

  return (
    <div className="text-right">
      <button type="button" disabled={send.isPending || !user.is_active} onClick={() => { if (window.confirm(`Email ${user.email} a link to set a new password?`)) send.mutate(); }}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-[#f40009] hover:bg-[#ffe9ea] disabled:opacity-50">
        {send.isPending ? "Sending…" : "Send reset email"}
      </button>
      {send.isSuccess && <p className="text-[11px] text-emerald-700">Sent</p>}
      {send.error && <p className="max-w-[16rem] text-[11px] text-[#c23a3a]">{(send.error as Error).message}</p>}
    </div>
  );
}

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
        ...(s.can("users.update") ? [{ header: "Password", cell: (u: AppUser) => <ResetButton user={u} />, className: "text-right" }] : []),
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
