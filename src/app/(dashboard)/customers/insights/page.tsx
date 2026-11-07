"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  Badge, Button, Card, ErrorNote, Field, Modal, PageHeader, Pager, SearchBox, SelectField, Stat, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass,
} from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { BUCKETS, GROUP_KINDS, whatsappNumber } from "../../../../lib/customer-insights";
import { formatKobo, relativeDay } from "../../../../lib/format";
import { PAYMENT_LABEL, PAYMENT_TONE } from "../../../../lib/status";
import { formatDateTime } from "../../../../lib/format";
import type { Customer, CustomerGroup, CustomerInsightRow, CustomerInsights, InsightBucket, Paginated, Sale } from "../../../../lib/types";

type BucketFilter = InsightBucket | "lapsed" | "";

export default function CustomerInsightsPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [bucket, setBucket] = useState<BucketFilter>("");
  const [network, setNetwork] = useState("");
  const [groupId, setGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("last_purchase");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [groupModal, setGroupModal] = useState<CustomerGroup | "new" | null>(null);
  const [addTo, setAddTo] = useState(false);
  const [rowGroups, setRowGroups] = useState<CustomerInsightRow | null>(null);
  const [viewing, setViewing] = useState<CustomerInsightRow | null>(null);
  const canManage = s.can("customers.manage");

  const params = () => {
    const p = new URLSearchParams({ sort, page: String(page) });
    if (bucket) p.set("bucket", bucket);
    if (network) p.set("network", network);
    if (groupId) p.set("group_id", groupId);
    if (search) p.set("search", search);
    return p;
  };
  const q = useQuery({ queryKey: ["customer-insights", bucket, network, groupId, search, sort, page], queryFn: () => api<CustomerInsights>(`/customers/insights?${params()}`) });
  const d = q.data;
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); setPicked(new Set()); };

  const toggle = (id: number) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = !!d && d.data.length > 0 && d.data.every((r) => picked.has(r.id));

  /** Every customer matching the current filters, not just this page. */
  const pickAllMatching = async () => {
    const p = params(); p.set("all", "1");
    const r = await api<CustomerInsights>(`/customers/insights?${p}`);
    setPicked(new Set(r.data.map((x) => x.id)));
  };

  const removeGroup = useMutation({
    mutationFn: (id: number) => api(`/customer-groups/${id}`, { method: "DELETE" }),
    onSuccess: () => { setGroupId(""); qc.invalidateQueries({ queryKey: ["customer-insights"] }); },
  });

  const groupOptions = [{ value: "", label: "Any group" }, ...(d?.groups ?? []).map((g) => ({ value: String(g.id), label: `${g.name} (${g.customers ?? 0})` }))];
  const networkOptions = [{ value: "", label: "Any network" }, ...(d?.summary.networks ?? []).map((n) => ({ value: n.name, label: `${n.name} (${n.customers})` }))];
  const lapsedTotal = d ? d.summary.buckets.d31_90 + d.summary.buckets.d91_180 + d.summary.buckets.d181_365 + d.summary.buckets.d365_plus : 0;

  return (
    <>
      <PageHeader title="Customer insights" description="Who is still buying, who has gone quiet, and your customers by network and by group." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={d?.summary.customers ?? "–"} note="Active customers on file" />
        <Stat label="Bought in last 90 days" value={d ? formatKobo(d.summary.recent_90) : "–"} tone="blue" />
        <Stat label="Quiet over a month" value={d ? lapsedTotal : "–"} tone="amber" note="Bought before, not within 30 days" />
        <Stat label="Never bought" value={d?.summary.buckets.never ?? "–"} tone="rose" />
      </div>

      <h2 className="mb-2 text-sm font-semibold">Time since last purchase</h2>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {BUCKETS.map((b) => {
          const on = bucket === b.value;
          return (
            <button key={b.value} type="button" aria-pressed={on} onClick={() => reset(setBucket)(on ? "" : b.value)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${on ? "border-[#ff3b3f] bg-[#ffe9ea]" : "border-line bg-surface hover:border-[#ff3b3f]/40"}`}>
              <span className="block text-xs text-ink-soft">{b.label}</span>
              <span className="mt-1 block text-2xl font-bold">{d?.summary.buckets[b.value] ?? "–"}</span>
              <span className="mt-1 block text-xs text-ink-soft">{b.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="By network (from the phone number)">
          <p className="px-5 pt-3 text-xs text-ink-soft">Read from the number&apos;s prefix. A customer who moved networks keeping their number may show under the old one.</p>
          <ul className="divide-y divide-line">
            {d?.summary.networks.map((n) => (
              <li key={n.name}>
                <button type="button" onClick={() => reset(setNetwork)(network === n.name ? "" : n.name)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-[#fff5f5] ${network === n.name ? "bg-[#ffe9ea]" : ""}`}>
                  <span className="font-semibold">{n.name}</span>
                  <span className="text-ink-soft">{n.customers} customer{n.customers === 1 ? "" : "s"} · {n.lapsed} quiet 3m+ · {formatKobo(n.lifetime)}</span>
                </button>
              </li>
            ))}
            {d && d.summary.networks.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No customers yet.</li>}
          </ul>
        </Card>

        <Card title="Your groups" action={canManage && <Button size="sm" onClick={() => setGroupModal("new")}>New group</Button>}>
          <ul className="divide-y divide-line">
            {d?.groups.map((g) => (
              <li key={g.id} className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${groupId === String(g.id) ? "bg-[#ffe9ea]" : ""}`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => reset(setGroupId)(groupId === String(g.id) ? "" : String(g.id))}>
                  <span className="font-semibold">{g.name}</span> <span className="text-xs text-ink-soft">{GROUP_KINDS.find((k) => k.value === g.kind)?.label}</span>
                  <span className="block text-xs text-ink-soft">{g.customers} customer{g.customers === 1 ? "" : "s"} · {g.lapsed} quiet 3m+ · {formatKobo(g.lifetime ?? 0)}</span>
                </button>
                {canManage && <Button size="sm" variant="ghost" onClick={() => setGroupModal(g)}>Edit</Button>}
              </li>
            ))}
            {d && d.groups.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No groups yet. Make one for a route, an area, or any set of customers you want to reach together, then add customers from the list below.</li>}
          </ul>
        </Card>
      </div>

      <Toolbar>
        <SearchBox id="insight-search" value={search} onChange={reset(setSearch)} placeholder="Search name or phone" />
        <div className="w-44"><SelectField label="Network" value={network} onChange={reset(setNetwork)} options={networkOptions} /></div>
        <div className="w-48"><SelectField label="Group" value={groupId} onChange={reset(setGroupId)} options={groupOptions} /></div>
        <div className="w-48"><SelectField label="Sort by" value={sort} onChange={reset(setSort)} options={[
          { value: "last_purchase", label: "Longest silent first" }, { value: "lifetime", label: "Biggest buyers" }, { value: "orders", label: "Most orders" }, { value: "name", label: "Name" },
        ]} /></div>
      </Toolbar>

      {(bucket || network || groupId) && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          Showing {d?.total ?? "…"} customers.
          <button type="button" className="font-semibold text-[#f40009] hover:underline" onClick={() => { setBucket(""); setNetwork(""); setGroupId(""); setPage(1); setPicked(new Set()); }}>Clear filters</button>
        </p>
      )}

      {canManage && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">{picked.size} selected</span>
          {d && d.total > d.data.length && <Button size="sm" variant="secondary" onClick={pickAllMatching}>Select all {d.total} matching</Button>}
          <Button size="sm" disabled={picked.size === 0} onClick={() => setAddTo(true)}>Add to group</Button>
          {picked.size > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>}
        </div>
      )}

      <TableCard min="64rem">
        <thead className={theadClass}>
          <tr>
            {canManage && <th className="w-10 px-4"><input type="checkbox" aria-label="Select this page" checked={allOnPage} onChange={() => setPicked((p) => { const n = new Set(p); d?.data.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; })} /></th>}
            <th scope="col" className={`${thClass} px-3`}>Customer</th>
            <th scope="col" className={thClass}>Network</th>
            <th scope="col" className={thClass}>Last purchase</th>
            <th scope="col" className={`${thClass} text-right`}>Orders</th>
            <th scope="col" className={`${thClass} text-right`}>Lifetime</th>
            <th scope="col" className={`${thClass} text-right`}>Last 90 days</th>
            <th scope="col" className={thClass}>Groups</th>
            <th scope="col" className={thClass}>Reach</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {q.isLoading && <TableLoading cols={9} />}
          {q.error && <TableError cols={9} message={(q.error as Error).message} />}
          {d?.data.length === 0 && <TableEmpty cols={9} title="No customers match" hint="Try clearing a filter." />}
          {d?.data.map((r) => {
            const bk = BUCKETS.find((b) => b.value === r.bucket)!;
            const wa = whatsappNumber(r.phone);
            return (
              <tr key={r.id} className="cursor-pointer transition-colors hover:bg-[#fff5f5]" onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,input,label")) setViewing(r); }}>
                {canManage && <td className="px-4"><input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td className="px-3 py-3"><button type="button" onClick={() => setViewing(r)} className="text-left font-semibold text-[#f40009] hover:underline">{r.name}</button><span className="block text-xs text-ink-soft">{r.phone ?? "No phone"}</span></td>
                <td className="px-4 py-3 text-ink-soft">{r.network}</td>
                <td className="px-4 py-3">
                  {r.last_purchase_at ? <>{relativeDay(r.last_purchase_at)} <span className="block text-xs text-ink-soft">{r.days_since} days ago</span></> : "–"}
                  <div className="mt-1"><Badge tone={bk.tone}>{bk.label}</Badge></div>
                </td>
                <td className="px-4 py-3 text-right">{r.orders}</td>
                <td className="px-4 py-3 text-right">{formatKobo(r.lifetime)}</td>
                <td className="px-4 py-3 text-right">{r.recent_90 ? formatKobo(r.recent_90) : "–"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {r.groups.map((g) => <Badge key={g.id}>{g.name}</Badge>)}
                    {canManage && <button type="button" className="text-xs font-semibold text-[#f40009] hover:underline" onClick={() => setRowGroups(r)}>{r.groups.length ? "Edit" : "Add"}</button>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.phone ? <a className="font-semibold text-[#f40009] hover:underline" href={`tel:${r.phone}`}>Call</a> : "–"}
                  {wa && <> · <a className="font-semibold text-[#f40009] hover:underline" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a></>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
      {d && <Pager page={page} last={d.last_page} total={d.total} current={d.current_page} setPage={setPage} />}

      {groupModal && (
        <GroupModal group={groupModal === "new" ? null : groupModal} onClose={() => setGroupModal(null)}
          onDelete={groupModal !== "new" ? () => { removeGroup.mutate(groupModal.id); setGroupModal(null); } : undefined} />
      )}
      {addTo && <AddToGroupModal ids={[...picked]} groups={d?.groups ?? []} onClose={() => setAddTo(false)} onDone={() => { setAddTo(false); setPicked(new Set()); }} />}
      {viewing && <ClientModal row={viewing} onClose={() => setViewing(null)} />}
      {rowGroups && <RowGroupsModal row={rowGroups} groups={d?.groups ?? []} onClose={() => setRowGroups(null)} />}
    </>
  );
}

function GroupModal({ group, onClose, onDelete }: { group: CustomerGroup | null; onClose: () => void; onDelete?: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [kind, setKind] = useState<string>(group?.kind ?? "route");
  const [notes, setNotes] = useState(group?.notes ?? "");
  const save = useMutation({
    mutationFn: () => api(group ? `/customer-groups/${group.id}` : "/customer-groups", { method: group ? "PUT" : "POST", body: { name, kind, notes: notes || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-insights"] }); onClose(); },
  });
  return (
    <Modal title={group ? "Edit group" : "New group"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Lekki route, Bar owners" />
        <SelectField label="What is it?" value={kind} onChange={setKind} options={GROUP_KINDS} />
        <Field label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-between gap-2">
          <div>{onDelete && <Button type="button" variant="danger" onClick={() => { if (confirm("Delete this group? The customers stay; only the grouping goes.")) onDelete(); }}>Delete</Button>}</div>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending}>Save</Button></div>
        </div>
      </form>
    </Modal>
  );
}

function AddToGroupModal({ ids, groups, onClose, onDone }: { ids: number[]; groups: CustomerGroup[]; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState(groups[0] ? String(groups[0].id) : "new");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("route");
  const save = useMutation({
    mutationFn: async () => {
      let id = Number(target);
      if (target === "new") id = (await api<{ id: number }>("/customer-groups", { method: "POST", body: { name, kind } })).id;
      return api(`/customer-groups/${id}/members`, { method: "POST", body: { mode: "add", customer_ids: ids } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-insights"] }); onDone(); },
  });
  return (
    <Modal title={`Add ${ids.length} customer${ids.length === 1 ? "" : "s"} to a group`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Group" value={target} onChange={setTarget} options={[...groups.map((g) => ({ value: String(g.id), label: g.name })), { value: "new", label: "＋ A new group" }]} />
        {target === "new" && (<><Field label="New group name" value={name} onChange={(e) => setName(e.target.value)} required /><SelectField label="What is it?" value={kind} onChange={setKind} options={GROUP_KINDS} /></>)}
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending}>Add</Button></div>
      </form>
    </Modal>
  );
}

function RowGroupsModal({ row, groups, onClose }: { row: CustomerInsightRow; groups: CustomerGroup[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [chosen, setChosen] = useState<Set<number>>(new Set(row.groups.map((g) => g.id)));
  const save = useMutation({
    mutationFn: () => api(`/customers/${row.id}/groups`, { method: "PUT", body: { group_ids: [...chosen] } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-insights"] }); onClose(); },
  });
  return (
    <Modal title={`Groups for ${row.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        {groups.length === 0 && <p className="text-sm text-ink-soft">Create a group first.</p>}
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id}><label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={chosen.has(g.id)} onChange={() => setChosen((p) => { const n = new Set(p); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })} /> {g.name}
            </label></li>
          ))}
        </ul>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}


/** A quick look at one client without leaving the list: contact, what they owe, how they buy and their latest orders. */
function ClientModal({ row, onClose }: { row: CustomerInsightRow; onClose: () => void }) {
  const doc = useQuery({ queryKey: ["customer", String(row.id)], queryFn: () => api<Customer>(`/customers/${row.id}`) });
  const sales = useQuery({ queryKey: ["list", "/sales", "customer", String(row.id), "peek"], queryFn: () => api<Paginated<Sale>>(`/sales?customer_id=${row.id}&per_page=6`) });
  const c = doc.data;
  const owing = c?.outstanding ?? 0;
  const wa = whatsappNumber(row.phone);
  const bk = BUCKETS.find((b) => b.value === row.bucket);

  return (
    <Modal title={row.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="-mt-2 text-sm text-ink-soft">{row.type === "wholesale" ? "Wholesale" : "Retail"} · {row.network}{bk && <> · <Badge tone={bk.tone}>{bk.label}</Badge></>}</p>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-ink-soft">Lifetime</dt><dd className="font-bold">{formatKobo(row.lifetime)}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-ink-soft">Last 90 days</dt><dd className="font-bold">{formatKobo(row.recent_90)}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-ink-soft">Orders</dt><dd className="font-bold">{row.orders}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-ink-soft">Last purchase</dt><dd className="font-bold">{row.last_purchase_at ? `${row.days_since} days ago` : "Never"}</dd></div>
          <div className={`rounded-xl p-3 ${owing > 0 ? "bg-amber-50" : "bg-paper"}`}><dt className="text-xs text-ink-soft">Owes now</dt><dd className="font-bold">{c ? formatKobo(owing) : "…"}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-ink-soft">Credit limit</dt><dd className="font-bold">{c ? (c.credit_limit ? formatKobo(c.credit_limit) : "Cash only") : "…"}</dd></div>
        </dl>

        <div className="space-y-1 text-sm">
          <p><span className="text-ink-soft">Phone: </span>{row.phone ?? "None on file"}</p>
          {c?.email && <p><span className="text-ink-soft">Email: </span>{c.email}</p>}
          <p><span className="text-ink-soft">Address: </span>{row.address ?? "None on file"}</p>
          {c?.notes && <p><span className="text-ink-soft">Notes: </span>{c.notes}</p>}
          {row.groups.length > 0 && <p className="flex flex-wrap items-center gap-1"><span className="text-ink-soft">Groups: </span>{row.groups.map((g) => <Badge key={g.id}>{g.name}</Badge>)}</p>}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Latest orders</p>
          {sales.isLoading && <p className="text-sm text-ink-soft">Loading…</p>}
          {sales.data?.data.length === 0 && <p className="text-sm text-ink-soft">No orders yet.</p>}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {sales.data?.data.map((o) => (
              <li key={o.id}><Link href={`/sales/view?id=${o.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-[#fff5f5]">
                <span><span className="font-mono text-xs font-bold text-[#f40009]">{o.number}</span><span className="block text-xs text-ink-soft">{formatDateTime(o.sold_at)}</span></span>
                <span className="text-right"><span className="block font-semibold">{formatKobo(o.total)}</span>{o.status === "void" ? <Badge tone="bad">Void</Badge> : <Badge tone={PAYMENT_TONE[o.payment_status]}>{PAYMENT_LABEL[o.payment_status]}</Badge>}</span>
              </Link></li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {row.phone && <a href={`tel:${row.phone}`}><Button variant="secondary">Call</Button></a>}
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><Button variant="secondary">WhatsApp</Button></a>}
          <Link href={`/customers/statement?id=${row.id}`}><Button variant="secondary">Statement</Button></Link>
          <Link href={`/customers/view?id=${row.id}`}><Button>Full profile</Button></Link>
        </div>
      </div>
    </Modal>
  );
}
