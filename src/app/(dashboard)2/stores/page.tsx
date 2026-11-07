"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CrudPage } from "../../../components/crud-page";
import { Button, ErrorNote, Modal, StatusBadge } from "../../../components/ui";
import { api } from "../../../lib/api";
import { MENU_CATALOGUE } from "../../../lib/menus";
import { useSession } from "../../../hooks/session";
import type { Store } from "../../../lib/types";

export default function StoresPage() {
  const s = useSession();
  const [menusFor, setMenusFor] = useState<Store | null>(null);

  if (!s.isPlatform) return <p className="text-sm text-ink-soft">Only platform admins can manage stores.</p>;

  return (
    <>
    <CrudPage<Store>
      title="Stores"
      noun="store"
      description="Each store is a separate depot business with its own branches, users and data."
      endpoint="/stores"
      canCreate
      canEdit
      columns={[
        { header: "Store", cell: (st) => <span className="font-medium">{st.name}</span> },
        { header: "Contact", cell: (st) => st.email ?? st.phone ?? "–" },
        { header: "Branches", cell: (st) => st.branches_count ?? 0 },
        { header: "Users", cell: (st) => st.users_count ?? 0 },
        { header: "Status", cell: (st) => <StatusBadge active={st.is_active} /> },
        {
          header: "Menus", className: "text-right",
          cell: (st) => (
            <Button size="sm" variant="secondary" onClick={() => setMenusFor(st)}>
              Menus{(st.settings?.disabled_menus?.length ?? 0) > 0 ? ` (${st.settings!.disabled_menus!.length} off)` : ""}
            </Button>
          ),
        },
      ]}
      fields={[
        { name: "name", label: "Store name", required: true },
        { name: "email", label: "Store email", type: "email" },
        { name: "phone", label: "Store phone" },
        { name: "branch_name", label: "First branch name", createOnly: true, hint: "Defaults to Head Office." },
        { name: "owner_name", label: "Owner's full name", required: true, createOnly: true },
        { name: "owner_email", label: "Owner's email", type: "email", required: true, createOnly: true },
        { name: "owner_password", label: "Owner's password", type: "password", required: true, createOnly: true, hint: "At least 8 characters." },
        { name: "is_active", label: "Store is active", type: "checkbox", editOnly: true },
      ]}
    />
    {menusFor && <MenusModal store={menusFor} onClose={() => setMenusFor(null)} />}
    </>
  );
}

function MenusModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const qc = useQueryClient();
  const [off, setOff] = useState<Set<string>>(new Set(store.settings?.disabled_menus ?? []));

  const save = useMutation({
    mutationFn: () => api(`/stores/${store.id}`, { method: "PUT", body: { disabled_menus: [...off] } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["list", "/stores"] }); onClose(); },
  });

  const flip = (href: string) => setOff((cur) => { const n = new Set(cur); if (n.has(href)) n.delete(href); else n.add(href); return n; });
  const flipGroup = (hrefs: string[], on: boolean) => setOff((cur) => { const n = new Set(cur); for (const h of hrefs) { if (on) n.delete(h); else n.add(h); } return n; });

  return (
    <Modal title={`Menus for ${store.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">Untick a menu to hide it from everyone in this business. Dashboard, My business and the Organization menus always stay on. Users see the change the next time the page loads.</p>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {MENU_CATALOGUE.map((g) => {
            const hrefs = g.items.map((i) => i.href);
            const allOn = hrefs.every((h) => !off.has(h));
            return (
              <fieldset key={g.group} className="rounded-xl border border-line p-3">
                <legend className="px-1 text-sm font-semibold">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={allOn} onChange={(e) => flipGroup(hrefs, e.target.checked)} className="size-4" /> {g.group}</label>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.items.map((i) => (
                    <label key={i.href} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!off.has(i.href)} onChange={() => flip(i.href)} className="size-4" /> {i.label}</label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending}>Save menus</Button>
        </div>
      </form>
    </Modal>
  );
}
