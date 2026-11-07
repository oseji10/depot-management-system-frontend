"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useSession } from "../hooks/session";
import { ApiError, api } from "../lib/api";
import { koboToInput, nairaToKobo } from "../lib/format";
import { GROUP_KINDS } from "../lib/customer-insights";
import type { Customer } from "../lib/types";
import { Button, ErrorNote, Field, Modal, MoneyField, SelectField } from "./ui";

/** A titled block of the form, so a long form reads in clear parts. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-[#fffafa] p-4">
      <h3 className="text-xs font-bold tracking-wider text-ink-soft uppercase">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

/** Create or edit a customer. Only people who can refund (managers, accountants) may set a credit limit. */
export function CustomerModal({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const s = useSession();
  const queryClient = useQueryClient();
  const canLimit = s.can("sales.refund");
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    type: customer?.type ?? "retail",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    empties_mode: customer?.empties_mode ?? "",
    credit_limit: koboToInput(customer?.credit_limit ?? 0),
    notes: customer?.notes ?? "",
    is_active: customer?.is_active ?? true,
  });
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const groups = useQuery({ queryKey: ["customer-groups", "choices"], enabled: !customer, queryFn: () => api<{ data: { id: number; name: string; kind: string }[] }>("/customer-groups") });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      api<Customer>(customer ? `/customers/${customer.id}` : "/customers", {
        method: customer ? "PUT" : "POST",
        body: {
          name: form.name, type: form.type, ...(form.empties_mode ? { empties_mode: form.empties_mode } : {}), phone: form.phone.trim(), email: form.email || null, address: form.address.trim(),
          ...(!customer && groupIds.length ? { group_ids: groupIds } : {}),
          notes: form.notes || null, ...(customer ? { is_active: form.is_active } : {}),
          ...(canLimit ? { credit_limit: nairaToKobo(form.credit_limit) } : {}),
        },
      }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      onSaved?.(c);
      onClose();
    },
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}),
  });

  return (
    <Modal title={customer ? "Edit customer" : "New customer"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
        <Section title="Who they are">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name?.[0]} required autoFocus className="sm:col-span-2" />
            <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={[{ value: "retail", label: "Retail" }, { value: "wholesale", label: "Wholesale" }]} />
          </div>
        </Section>

        <Section title="How to reach them" hint="Phone and address are needed for deliveries, statements and collecting what they owe.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone?.[0]} placeholder="0803 000 0000" required />
            <Field label="Email (optional)" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} error={errors.email?.[0]} />
            <Field label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} error={errors.address?.[0]} placeholder="Street, area, town" required className="sm:col-span-2" />
          </div>
        </Section>

        {!customer && (
          <Section title="Groups" hint="Put them on a route, in an area or in a segment. Optional, and you can change it later.">
            {groups.isLoading ? (
              <p className="text-sm text-ink-soft">Loading groups…</p>
            ) : (groups.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">No groups yet. Create them under Customer insights, then pick them here.</p>
            ) : (
              <div role="group" aria-label="Customer groups" className="flex flex-wrap gap-2">
                {(groups.data?.data ?? []).map((g) => {
                  const on = groupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button" aria-pressed={on} onClick={() => setGroupIds((cur) => (on ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-[#f40009] bg-[#ffe9ea] text-[#f40009]" : "border-line bg-white text-ink-soft hover:border-[#ff3b3f]/50"}`}>
                      {g.name}<span className="ml-1.5 text-xs opacity-70">{GROUP_KINDS.find((k) => k.value === g.kind)?.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        <Section title="Credit and returnables">
          <SelectField label="Returnable bottles and crates" value={form.empties_mode || (form.type === "wholesale" ? "balance" : "deposit")} onChange={(v) => set("empties_mode", v)}
            options={[{ value: "deposit", label: "Pays a deposit, refunded on return" }, { value: "balance", label: "No money: keep count of what they hold" }, { value: "none", label: "Do not track" }]}
            hint="Retail customers usually pay a deposit; regular wholesale customers run a balance." />

          {canLimit && (
            <MoneyField label="Credit limit" value={form.credit_limit} onChange={(v) => set("credit_limit", v)} error={errors.credit_limit?.[0]}
              hint="The most this customer may owe at once. Leave empty or 0 for cash only." placeholder="0" />
          )}
        </Section>

        <Section title="Other">
          <Field label="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} />

          {customer && (
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="size-4 accent-[#f40009]" />
              Active customer
            </label>
          )}
        </Section>

        {save.error && !Object.keys(errors).length && <ErrorNote>{(save.error as Error).message}</ErrorNote>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!form.name.trim() || !form.phone.trim() || !form.address.trim()}>{customer ? "Save changes" : "Add customer"}</Button>
        </div>
      </form>
    </Modal>
  );
}
