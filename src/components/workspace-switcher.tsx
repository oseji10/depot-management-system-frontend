"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "../hooks/session";
import { api } from "../lib/api";
import { getBranchId, getWarehouseId, setWorkspace } from "../lib/auth";
import type { MyBusinesses, WorkspaceOptions } from "../lib/types";
import { Button, ErrorNote, Field, Modal } from "./ui";

const selectClass = "w-full appearance-none rounded-xl border border-white/15 bg-white/[0.06] py-2.5 pr-3 pl-3 text-sm text-white transition hover:bg-white/10 focus:border-white focus:outline-none";
const labelClass = "mb-1.5 block text-[11px] font-bold tracking-[0.14em] text-white uppercase";

/** Everything cached belongs to the previous view, so start clean on the new one. */
function restart(qc: ReturnType<typeof useQueryClient>) {
  qc.clear();
  window.location.assign("/");
}

/** For owners with more than one business, or room to start another. */
export function BusinessSwitcher() {
  const s = useSession();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ["my-businesses"], enabled: !s.isPlatform && !!s.store, queryFn: () => api<MyBusinesses>("/businesses") });
  const d = q.data;
  const sw = useMutation({ mutationFn: (id: number) => api(`/businesses/${id}/switch`, { method: "POST" }), onSuccess: () => { setWorkspace(null, null); restart(qc); } });

  if (!d || (d.data.length < 2 && d.owned === 0)) return null;

  return (
    <div className="relative px-4 pb-3">
      <label htmlFor="business-switch" className={labelClass}>Business</label>
      <select id="business-switch" value={d.current} disabled={sw.isPending} className={selectClass}
        onChange={(e) => { if (e.target.value === "new") setAdding(true); else if (Number(e.target.value) !== d.current) sw.mutate(Number(e.target.value)); }}>
        {d.data.map((b) => <option key={b.id} value={b.id} className="text-ink">{b.name}</option>)}
        {d.owned > 0 && <option value="new" className="text-ink">+ Add a business…</option>}
      </select>
      {sw.error && <p className="mt-1 text-xs text-white">{(sw.error as Error).message}</p>}
      {adding && <AddBusiness info={d} onClose={() => setAdding(false)} onDone={() => { setWorkspace(null, null); restart(qc); }} />}
    </div>
  );
}

function AddBusiness({ info, onClose, onDone }: { info: MyBusinesses; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("Head Office");
  const run = useMutation({ mutationFn: () => api("/businesses", { method: "POST", body: { name, branch_name: branch || null } }), onSuccess: onDone });

  return (
    <Modal title="Add a business" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="space-y-4 text-ink">
        <p className="text-sm text-ink-soft">You own {info.owned} of the {info.allowed} business{info.allowed === 1 ? "" : "es"} your plan allows. The new one has its own stock, customers and books, and starts on a free trial.</p>
        {!info.can_create ? <ErrorNote>Your plan allows {info.allowed} business{info.allowed === 1 ? "" : "es"}. Upgrade your plan to add more.</ErrorNote> : (
          <>
            <Field label="Business name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            <Field label="First branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </>
        )}
        {run.error && <ErrorNote>{(run.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={run.isPending} disabled={!info.can_create || !name.trim()}>Create and switch</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Narrows the whole app to one branch, and optionally one warehouse. Only for users who see every branch. */
export function ScopeSwitcher() {
  const s = useSession();
  const qc = useQueryClient();
  const cacheKey = `depot.workspace.${s.store?.id ?? 0}`;
  const q = useQuery({
    queryKey: ["workspace-options"], enabled: s.level === "store" && !!s.store, retry: 1,
    queryFn: async () => {
      const fresh = await api<WorkspaceOptions>("/workspace/options");
      try { localStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch { /* private mode */ }
      return fresh;
    },
  });
  // If the list cannot be loaded right now, keep showing the last one so the switcher never vanishes while a branch or warehouse is chosen.
  let remembered: WorkspaceOptions | undefined;
  try { remembered = JSON.parse(localStorage.getItem(cacheKey) ?? "null") ?? undefined; } catch { remembered = undefined; }
  const d = q.data ?? remembered;
  const branch = getBranchId() ?? "";
  const warehouse = getWarehouseId() ?? "";

  const single = !!d && d.branches.length === 1;   // one branch: no point asking which, go straight to its warehouses
  if (!d && q.error) return <p className="px-4 pb-3 text-xs text-white">Could not load branches: {(q.error as Error).message}</p>;
  if (!d || (d.branches.length < 2 && d.warehouses.length < 2)) return null;

  const apply = (b: string, w: string) => { setWorkspace(b || null, w || null); qc.clear(); window.location.reload(); };
  const shown = branch || single ? d.warehouses.filter((w) => single || String(w.branch_id) === branch) : [];

  return (
    <div className="relative space-y-2 px-4 pb-3">
      {!single && <div>
        <label htmlFor="branch-switch" className={labelClass}>Branch</label>
        <select id="branch-switch" value={branch} className={selectClass} onChange={(e) => apply(e.target.value, "")}>
          <option value="" className="text-ink">All branches</option>
          {d.branches.map((b) => <option key={b.id} value={b.id} className="text-ink">{b.name}</option>)}
        </select>
      </div>}
      <div>
        <label htmlFor="warehouse-switch" className={labelClass}>Warehouse</label>
        <select id="warehouse-switch" value={warehouse} disabled={!branch && !single} className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
          onChange={(e) => { const w = d.warehouses.find((x) => String(x.id) === e.target.value); apply(w ? String(w.branch_id) : branch, e.target.value); }}>
          <option value="" className="text-ink">{branch || single ? (shown.length ? (single ? "All warehouses" : "All warehouses in this branch") : "No warehouses here") : "Choose a branch first"}</option>
          {shown.map((w) => <option key={w.id} value={w.id} className="text-ink">{w.name}</option>)}
        </select>
      </div>
    </div>
  );
}
