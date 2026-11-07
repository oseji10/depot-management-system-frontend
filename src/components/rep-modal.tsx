"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOptions } from "../hooks/options";
import { useSession } from "../hooks/session";
import { ApiError, api } from "../lib/api";
import type { Rep } from "../lib/types";
import { DeleteButton } from "./delete-button";
import { RoutePicker } from "./route-picker";
import { Button, ErrorNote, Field, Modal, SelectField } from "./ui";

type Machine = { id: number; name: string; provider: string | null; branch_id: number | null; with_rep: boolean };

/** Creates a salesperson (a login and a van of their own), or edits one: details, branch, routes and card terminal. */
export function RepModal({ rep, onClose }: { rep?: Rep; onClose: () => void }) {
  const s = useSession();
  const queryClient = useQueryClient();
  const branches = useOptions("/branches");
  const [form, setForm] = useState({
    name: rep?.name ?? "", email: rep?.email ?? "", phone: rep?.phone ?? "", password: "",
    branch_id: rep?.branch_id ? String(rep.branch_id) : s.branch ? String(s.branch.id) : "",
    terminal: rep?.terminal ? String(rep.terminal.id) : "",
  });
  const [routeIds, setRouteIds] = useState<number[]>(rep?.routes?.map((r) => r.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const branchId = form.branch_id || (branches.length === 1 ? String(branches[0].value) : "");

  // Machines nobody else carries, plus this salesperson's own, for their branch.
  const machines = useQuery({ queryKey: ["trip-terminals", rep?.id ?? 0], queryFn: () => api<{ data: Machine[] }>(`/trips/terminals${rep ? `?rep_id=${rep.id}` : ""}`) });
  const machineList = (machines.data?.data ?? []).filter((m) => !m.branch_id || !branchId || String(m.branch_id) === branchId);

  const save = useMutation({
    mutationFn: () => {
      const common = { name: form.name, phone: form.phone || null, route_ids: routeIds, pos_terminal_id: form.terminal ? Number(form.terminal) : null };
      return rep
        ? api(`/reps/${rep.id}`, { method: "PUT", body: { ...common, email: form.email, branch_id: Number(branchId), ...(form.password ? { password: form.password } : {}) } })
        : api("/reps", { method: "POST", body: { ...common, email: form.email, password: form.password, branch_id: Number(branchId) } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      queryClient.invalidateQueries({ queryKey: ["trip-terminals"] });
      queryClient.invalidateQueries({ queryKey: ["list", "/pos-terminals"] });
      onClose();
    },
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? {}) : { _: [e.message] }),
  });

  return (
    <Modal title={rep ? `Edit ${rep.name}` : "New salesperson"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
        {!rep && <p className="text-sm text-ink-soft">They get a login and their own van. They can only sell what you issue to them, and only see their own sales.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name?.[0]} required className="sm:col-span-2" />
          <Field label="Email (their login)" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} error={errors.email?.[0]} required />
          <Field label="Phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone?.[0]} />
          <Field
            label={rep ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} error={errors.password?.[0]}
            hint={rep ? "Leave empty to keep the current password." : "At least 8 characters. Share it with them privately."} required={!rep} autoComplete="new-password"
          />
          {s.level === "branch" ? null : (
            <SelectField label="Branch" value={branchId} onChange={(v) => set("branch_id", v)} error={errors.branch_id?.[0]} required
              options={[{ value: "", label: "Choose…" }, ...branches]} />
          )}
          <div className="sm:col-span-2">
            <SelectField
              label="Card terminal (optional)" value={form.terminal} onChange={(v) => set("terminal", v)} error={errors.pos_terminal_id?.[0]}
              hint="The POS machine they carry. Their card payments and POS transfers are tied to it, between trips too. You can also pick one when issuing stock."
              options={[{ value: "", label: "None" }, ...machineList.map((m) => ({ value: m.id, label: `${m.name}${m.provider ? ` · ${m.provider}` : ""}` }))]}
            />
          </div>
        </div>
        <RoutePicker value={routeIds} onChange={setRouteIds} />
        {errors._ && <ErrorNote>{errors._[0]}</ErrorNote>}
        {!Object.keys(errors).length && save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {rep && (
              rep.can_delete
                ? <DeleteButton path={`/reps/${rep.id}`} noun="salesperson" onDone={() => { queryClient.invalidateQueries({ queryKey: ["reps"] }); queryClient.invalidateQueries({ queryKey: ["trip-terminals"] }); onClose(); }} />
                : <p className="max-w-56 text-xs text-ink-soft">Has sales or trip history, so they can&apos;t be deleted. Disable them instead.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" busy={save.isPending} disabled={!form.name || !form.email || (!rep && form.password.length < 8) || (!!form.password && form.password.length < 8) || !branchId}>{rep ? "Save changes" : "Create salesperson"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
