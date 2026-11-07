"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Badge, Button, Chips, ErrorNote, Field, ICON, Modal, MoneyField, PageHeader, Pager, SelectField, Svg, TableCard, TableEmpty, TableError, TableLoading, theadClass, thClass,
} from "../../../components/ui";
import { CustomerPicker } from "../../../components/customer-picker";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { ApiError, api } from "../../../lib/api";
import { formatDateTime, formatKobo, koboToInput, nairaToKobo } from "../../../lib/format";
import type { ContainerHolding, ContainerMovement, ContainerSummary, ContainerType, Customer, Paginated } from "../../../lib/types";

type Tab = "overview" | "customers" | "history";
type Action = "receive" | "write-off" | "adjust" | "supplier" | "types";

const KIND_LABEL: Record<string, string> = {
  sale: "Sold with goods", sale_void: "Sale voided", return: "Returned", write_off: "Written off", adjustment: "Count adjusted", supplier_in: "From Coca-Cola", supplier_out: "Sent to Coca-Cola",
};

export default function ContainersPage() {
  const s = useSession();
  const canManage = s.can("containers.manage");
  const [tab, setTab] = useState<Tab>("overview");
  const [action, setAction] = useState<Action | null>(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useQuery({ queryKey: ["containers", "summary"], queryFn: () => api<{ data: ContainerSummary[] }>("/containers/summary") });
  const holdings = useQuery({ queryKey: ["containers", "holdings"], enabled: tab === "customers", queryFn: () => api<{ data: ContainerHolding[] }>("/containers/holdings") });
  const history = useQuery({ queryKey: ["containers", "movements", page], enabled: tab === "history", queryFn: () => api<Paginated<ContainerMovement>>(`/containers/movements?page=${page}`) });

  const types = summary.data?.data ?? [];
  const deposits = types.reduce((n, t) => n + t.deposits_held, 0);

  return (
    <>
      <PageHeader
        title="Crates & bottles"
        description="Returnable containers: what is on your shelf, what customers are holding, deposits you owe back, and what you owe Coca-Cola."
        action={canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAction("types")}>Container types</Button>
            <Button variant="secondary" onClick={() => setAction("supplier")}>Coca-Cola</Button>
            <Button variant="secondary" onClick={() => setAction("adjust")}>Count shelf</Button>
            <Button onClick={() => setAction("receive")}><Svg d={ICON.plus} /> Receive empties</Button>
          </div>
        )}
      />

      {notice && <p className="mb-4 rounded-xl bg-[#ffe9ea] px-4 py-3 text-sm font-medium text-[#a50006]">{notice}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Chips<Tab> label="View" value={tab} onChange={(v) => { setTab(v); setPage(1); }} options={[{ value: "overview", label: "Overview" }, { value: "customers", label: "Held by customers" }, { value: "history", label: "History" }]} />
        {deposits > 0 && <Badge tone="warn">{formatKobo(deposits)} in deposits held for customers</Badge>}
      </div>

      {tab === "overview" && (
        <TableCard min="46rem">
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Container</th><th className={`${thClass} text-right`}>On your shelf</th><th className={`${thClass} text-right`}>With customers</th>
              <th className={`${thClass} text-right`}>Deposits held</th><th className={`${thClass} text-right`}>Owed to Coca-Cola</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summary.isLoading && <TableLoading cols={5} />}
            {summary.error && <TableError cols={5} message={(summary.error as Error).message} />}
            {summary.data && types.length === 0 && <TableEmpty cols={5} title="No container types yet" hint="Add your bottle and crate types first, with their deposit." />}
            {types.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3.5"><p className="font-semibold">{t.name}</p><p className="text-xs text-ink-soft">{t.kind === "crate" ? "Crate" : "Bottle"} · deposit {formatKobo(t.deposit)}{t.is_active === false ? " · inactive" : ""}</p></td>
                <td className="px-4 py-3.5 text-right">
                  <p className="font-semibold">{t.on_shelf.toLocaleString("en-NG")}</p>
                  {t.by_warehouse.length > 1 && <p className="text-xs text-ink-soft">{t.by_warehouse.map((w) => `${w.name}: ${w.qty}`).join(" · ")}</p>}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold">{t.with_customers.toLocaleString("en-NG")}</td>
                <td className="px-4 py-3.5 text-right font-semibold">{t.deposits_held ? formatKobo(t.deposits_held) : "–"}</td>
                <td className={`px-4 py-3.5 text-right font-semibold ${t.owed_to_supplier > 0 ? "text-amber-700" : ""}`}>{t.owed_to_supplier.toLocaleString("en-NG")}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {tab === "customers" && (
        <TableCard min="38rem">
          <thead className={theadClass}>
            <tr><th className={thClass}>Customer</th><th className={thClass}>Container</th><th className={`${thClass} text-right`}>Holding</th><th className={`${thClass} text-right`}>Deposit paid</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {holdings.isLoading && <TableLoading cols={5} />}
            {holdings.error && <TableError cols={5} message={(holdings.error as Error).message} />}
            {holdings.data?.data.length === 0 && <TableEmpty cols={5} title="Nobody is holding containers" hint="Containers appear here when a sale takes them out and they have not come back." />}
            {holdings.data?.data.map((h) => (
              <tr key={`${h.customer_id}-${h.container_type_id}`}>
                <td className="px-4 py-3 font-medium">{h.customer}</td>
                <td className="px-4 py-3">{h.container}</td>
                <td className="px-4 py-3 text-right font-semibold">{h.quantity}</td>
                <td className="px-4 py-3 text-right">{h.deposit ? formatKobo(h.deposit) : "–"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && h.quantity > 0 && (
                    <button type="button" onClick={() => setAction("receive")} className="text-sm font-semibold text-[#f40009] hover:underline">Receive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {tab === "history" && (
        <>
          <TableCard min="46rem">
            <thead className={theadClass}>
              <tr><th className={thClass}>When</th><th className={thClass}>What</th><th className={thClass}>Container</th><th className={thClass}>Who</th><th className={`${thClass} text-right`}>Customer/supplier</th><th className={`${thClass} text-right`}>Shelf</th><th className={`${thClass} text-right`}>Deposit</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.isLoading && <TableLoading cols={7} />}
              {history.error && <TableError cols={7} message={(history.error as Error).message} />}
              {history.data?.data.length === 0 && <TableEmpty cols={7} title="Nothing recorded yet" />}
              {history.data?.data.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{formatDateTime(m.created_at)}</td>
                  <td className="px-4 py-2.5">{KIND_LABEL[m.kind] ?? m.kind}{m.note && <span className="text-ink-soft"> · {m.note}</span>}</td>
                  <td className="px-4 py-2.5">{m.type?.name}</td>
                  <td className="px-4 py-2.5">{m.party_name ?? "–"}</td>
                  <td className="px-4 py-2.5 text-right">{m.qty_party > 0 ? `+${m.qty_party}` : m.qty_party || "–"}</td>
                  <td className="px-4 py-2.5 text-right">{m.qty_depot > 0 ? `+${m.qty_depot}` : m.qty_depot || "–"}</td>
                  <td className="px-4 py-2.5 text-right">{m.deposit ? `${m.deposit > 0 ? "+" : "−"}${formatKobo(Math.abs(m.deposit))}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          {history.data && <Pager page={page} last={history.data.last_page} total={history.data.total} current={history.data.data.length} setPage={setPage} />}
        </>
      )}

      {action === "types" && <TypesModal types={types} onClose={() => setAction(null)} />}
      {action && action !== "types" && (
        <MovementModal kind={action} types={types} onClose={() => setAction(null)} onDone={(m) => { setAction(null); setNotice(m); }} />
      )}
    </>
  );
}

function MovementModal({ kind, types, onClose, onDone }: { kind: Exclude<Action, "types">; types: ContainerType[]; onClose: () => void; onDone: (message: string) => void }) {
  const queryClient = useQueryClient();
  const warehouses = useOptions("/warehouses");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [direction, setDirection] = useState("in");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const wh = warehouseId || String(warehouses[0]?.value ?? "");
  const title = { receive: "Receive empties from a customer", "write-off": "Write off containers not coming back", adjust: "Count empties on the shelf", supplier: "Containers to or from Coca-Cola" }[kind];

  const save = useMutation({
    mutationFn: () => {
      const n = parseInt(qty, 10);
      const base = { container_type_id: Number(typeId), warehouse_id: Number(wh), note: note || null };
      if (kind === "adjust") return api("/containers/adjust", { method: "POST", body: { ...base, quantity: n, note: note || "Count" } });
      if (kind === "supplier") return api("/containers/supplier", { method: "POST", body: { ...base, quantity: n, direction } });
      return api(kind === "receive" ? "/containers/receive" : "/containers/write-off", { method: "POST", body: { ...base, quantity: n, customer_id: customer?.id ?? null, ...(kind === "receive" ? { method } : {}) } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      onDone("Saved.");
    },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  const needsCustomer = kind === "receive" || kind === "write-off";
  const ready = typeId && wh && /^-?\d+$/.test(qty) && qty !== "0" && (!needsCustomer || customer || walkIn);

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-4">
        {needsCustomer && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Customer</p>
            {!walkIn && <CustomerPicker value={customer} onChange={setCustomer} />}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={walkIn} onChange={(e) => { setWalkIn(e.target.checked); setCustomer(null); }} className="size-4 accent-[#f40009]" />
              Walk-in customer (no account)
            </label>
          </div>
        )}
        {kind === "supplier" && (
          <SelectField label="Direction" value={direction} onChange={setDirection}
            options={[{ value: "in", label: "Received from Coca-Cola (we owe empties)" }, { value: "out", label: "Empties sent back to Coca-Cola" }]} />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Container" value={typeId} onChange={setTypeId} options={[{ value: "", label: "Select" }, ...types.map((t) => ({ value: t.id, label: t.name }))]} error={errors.container_type_id?.[0]} required />
          <SelectField label="Warehouse" value={wh} onChange={setWarehouseId} options={warehouses} error={errors.warehouse_id?.[0]} />
          <Field label={kind === "adjust" ? "Change (+ add, − remove)" : "How many"} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(kind === "adjust" ? /[^0-9-]/g : /\D/g, ""))} error={errors.quantity?.[0]} required />
          {kind === "receive" && <SelectField label="Deposit refunded by" value={method} onChange={setMethod} options={[{ value: "cash", label: "Cash" }, { value: "transfer", label: "Bank transfer" }]} hint="Only matters if they paid a deposit." />}
        </div>
        <Field label={kind === "adjust" ? "Reason" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note?.[0]} required={kind === "adjust"} />
        {kind === "write-off" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Any deposit held for these containers is kept by the depot and booked as other income.</p>}
        {formError && !Object.keys(errors).length && <ErrorNote>{formError}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!ready}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function TypesModal({ types, onClose }: { types: ContainerSummary[] | ContainerType[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ContainerType | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("bottle");
  const [deposit, setDeposit] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const start = (t: ContainerType | null) => { setEditing(t); setName(t?.name ?? ""); setKind(t?.kind ?? "bottle"); setDeposit(koboToInput(t?.deposit ?? 0)); setErrors({}); };

  const save = useMutation({
    mutationFn: () => api(editing ? `/container-types/${editing.id}` : "/container-types", {
      method: editing ? "PUT" : "POST", body: { name, deposit: nairaToKobo(deposit), ...(editing ? {} : { kind }) },
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["containers"] }); queryClient.invalidateQueries({ queryKey: ["container-types"] }); setName(""); setDeposit(""); setEditing(null); },
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? {}) : { name: [e.message] }),
  });

  return (
    <Modal title="Container types" onClose={onClose}>
      <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
        {types.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">None yet. Add a bottle and a crate below.</li>}
        {types.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span><span className="font-semibold">{t.name}</span> <span className="text-ink-soft">· {t.kind} · deposit {formatKobo(t.deposit)}</span></span>
            <button type="button" onClick={() => start(t)} className="font-semibold text-[#f40009] hover:underline">Edit</button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm font-semibold">{editing ? `Edit ${editing.name}` : "Add a container type"}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} placeholder="Bottle 50cl" required />
          <SelectField label="Kind" value={kind} onChange={setKind} options={[{ value: "bottle", label: "Bottle" }, { value: "crate", label: "Crate" }]} hint={editing ? "Cannot be changed." : undefined} />
          <MoneyField label="Deposit each" value={deposit} onChange={setDeposit} error={errors.deposit?.[0]} placeholder="0" />
        </div>
        <div className="flex justify-end gap-2">
          {editing && <Button type="button" variant="secondary" onClick={() => start(null)}>Cancel edit</Button>}
          <Button type="submit" busy={save.isPending} disabled={!name.trim()}>{editing ? "Save" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}
