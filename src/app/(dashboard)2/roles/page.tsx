"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Field, Modal, PageHeader } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import type { Role } from "../../../lib/types";

type Catalogue = Record<string, string[]>;

export default function RolesPage() {
  const s = useSession();
  const [editing, setEditing] = useState<Role | "new" | null>(null);

  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<{ data: Role[] }>("/roles") });

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a named set of permissions. Create your own, or adjust the standard ones, to match how your depot works."
        action={s.can("roles.manage") && <Button onClick={() => setEditing("new")}>Add role</Button>}
      />

      {s.isPlatform && !roles.data?.data.length && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">Pick a store in the sidebar to see its roles.</p>
      )}

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Permissions</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roles.data?.data.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">
                  {r.name} {r.is_template && <Badge>Standard</Badge>}
                </td>
                <td className="px-4 py-3 text-ink-soft">{r.permissions.length} permissions</td>
                <td className="px-4 py-3 text-right">
                  {s.can("roles.manage") && r.name !== "Owner" && (
                    <button onClick={() => setEditing(r)} className="font-semibold text-[#f40009] hover:underline">
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <RoleForm role={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function RoleForm({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const s = useSession();
  const [name, setName] = useState(role?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const catalogue = useQuery({ queryKey: ["permission-catalogue"], queryFn: () => api<{ data: Catalogue }>("/roles/permissions") });

  const save = useMutation({
    mutationFn: () => {
      const body = { name, permissions: [...selected] };
      return role ? api(`/roles/${role.id}`, { method: "PUT", body }) : api("/roles", { method: "POST", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["options"] });
      onClose();
    },
    onError: (e: Error) => {
      setError(e.message);
      setFieldErrors(e instanceof ApiError ? (e.errors ?? {}) : {});
    },
  });

  const toggle = (perm: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });

  const toggleGroup = (perms: string[]) =>
    setSelected((cur) => {
      const next = new Set(cur);
      const allOn = perms.every((p) => next.has(p));
      perms.forEach((p) => (allOn ? next.delete(p) : next.add(p)));
      return next;
    });

  return (
    <Modal title={role ? `Edit ${role.name}` : "Add role"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate(); }} className="space-y-4">
        <Field
          label="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={role?.is_template}
          hint={role?.is_template ? "Standard roles keep their name." : undefined}
          error={fieldErrors.name?.[0]}
          required
        />

        <div className="space-y-4">
          {Object.entries(catalogue.data?.data ?? {}).map(([group, perms]) => (
            <fieldset key={group} className="rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-semibold">
                {group}{" "}
                <button type="button" onClick={() => toggleGroup(perms)} className="ml-1 text-xs font-normal text-[#f40009] hover:underline">
                  Toggle all
                </button>
              </legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {perms.map((perm) => {
                  const allowed = s.can(perm); // you can only grant what you hold
                  return (
                    <label key={perm} className={`flex items-center gap-2 text-sm ${allowed ? "" : "opacity-40"}`}>
                      <input
                        type="checkbox"
                        className="size-4 accent-[#f40009]"
                        checked={selected.has(perm)}
                        disabled={!allowed}
                        onChange={() => toggle(perm)}
                      />
                      {perm}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {(error || fieldErrors.permissions) && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">
            {fieldErrors.permissions?.[0] ?? error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending}>{role ? "Save changes" : "Add role"}</Button>
        </div>
      </form>
    </Modal>
  );
}
