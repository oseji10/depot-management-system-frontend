"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { withSuspense } from "../../../../components/suspense-page";
import { VehicleFormFields, vehicleBody } from "../../../../components/vehicle-form";
import { DeleteButton } from "../../../../components/delete-button";
import { Badge, Button, Card, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, Stat } from "../../../../components/ui";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDate, formatDateTime, formatKobo, nairaToKobo } from "../../../../lib/format";
import type { VehicleDetail, VehicleDoc } from "../../../../lib/types";
import { DOC_KINDS, SERVICE_KINDS, VEHICLE_STATUS, VEHICLE_TONE, VEHICLE_TYPES, docState } from "../../../../lib/vehicles";

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function VehiclePage() {
  const id = useIdParam();
  const s = useSession();
  const qc = useQueryClient();
  const manage = s.can("vehicles.manage");
  const [dialog, setDialog] = useState<null | "edit" | "service" | { doc: VehicleDoc | "new" }>(null);

  const q = useQuery({ queryKey: ["vehicle", id], enabled: !!id, queryFn: () => api<VehicleDetail>(`/vehicles/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["vehicle", id] }); qc.invalidateQueries({ queryKey: ["vehicles"] }); };
  const removeDoc = useMutation({ mutationFn: (docId: number) => api(`/vehicle-documents/${docId}`, { method: "DELETE" }), onSuccess: refresh });
  const removeService = useMutation({ mutationFn: (sid: number) => api(`/vehicle-services/${sid}`, { method: "DELETE" }), onSuccess: refresh });
  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/vehicles/${id}`, { method: "PUT", body: { ...vehicleBody(formFrom(q.data!)), status } }),
    onSuccess: refresh,
  });

  const v = q.data;
  if (!v) return <p className="p-6 text-sm text-ink-soft">{q.error ? (q.error as Error).message : "Loading…"}</p>;

  const err = removeDoc.error ?? removeService.error ?? setStatus.error;
  const th = "px-3 py-2 font-semibold";
  const head = "border-b border-line text-[11px] tracking-wider text-ink-soft uppercase";

  return (
    <>
      <PageHeader
        title={v.reg_no}
        crumb={<Link href="/vehicles" className="text-[#f40009] hover:underline">← Vehicles</Link>}
        description={[v.nickname, [v.make, v.model, v.year].filter(Boolean).join(" "), VEHICLE_TYPES[v.type], v.branch?.name, v.driver ? `Driver: ${v.driver.name}` : null].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={VEHICLE_TONE[v.status]}>{VEHICLE_STATUS[v.status]}</Badge>
            {manage && v.status === "active" && <Button variant="secondary" onClick={() => setStatus.mutate("in_workshop")}>Send to workshop</Button>}
            {manage && v.status === "in_workshop" && <Button variant="secondary" onClick={() => setStatus.mutate("active")}>Back on the road</Button>}
            {manage && <Button onClick={() => setDialog("edit")}>Edit details</Button>}
            {manage && <DeleteButton path={`/vehicles/${v.id}`} noun="vehicle" onDone={() => { qc.invalidateQueries({ queryKey: ["vehicles"] }); window.location.href = "/vehicles/"; }} />}
          </div>
        }
      />
      {err && <div className="mb-3"><ErrorNote>{(err as Error).message}</ErrorNote></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Odometer" value={`${v.odometer.toLocaleString("en-NG")} km`} />
        <Stat label="Trips" value={v.totals.trips} />
        <Stat label="Fuel drawn" value={formatKobo(v.totals.fuel)} tone="amber" note={v.totals.litres ? `${v.totals.litres.toLocaleString("en-NG")} litres` : undefined} />
        <Stat label="Maintenance" value={formatKobo(v.totals.maintenance)} tone="blue" />
      </div>

      <div className="space-y-4">
        <Card title="Papers" action={manage && <Button size="sm" variant="secondary" onClick={() => setDialog({ doc: "new" })}>Add paper</Button>}>
          {v.documents.length === 0 ? <p className="text-sm text-ink-soft">No papers recorded. Add the insurance, roadworthiness and licence so you get warned before they lapse.</p> : (
            <ul className="divide-y divide-line">
              {v.documents.map((d) => {
                const st = docState(d.expires_on);
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span><span className="font-medium">{DOC_KINDS[d.kind as keyof typeof DOC_KINDS] ?? d.kind}</span>{d.reference ? <span className="text-ink-soft"> · {d.reference}</span> : null}
                      <span className="block text-xs text-ink-soft">{d.expires_on ? `Expires ${formatDate(d.expires_on)}` : "No expiry date"}</span></span>
                    <span className="flex items-center gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {manage && <>
                        <button type="button" className="text-xs font-semibold text-[#f40009] hover:underline" onClick={() => setDialog({ doc: d })}>Edit</button>
                        <button type="button" className="text-xs font-semibold text-[#c23a3a] hover:underline" onClick={() => { if (window.confirm("Remove this paper?")) removeDoc.mutate(d.id); }}>Remove</button>
                      </>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Services and repairs" action={manage && <Button size="sm" variant="secondary" onClick={() => setDialog("service")}>Log service or repair</Button>}>
          {v.services.length === 0 ? <p className="text-sm text-ink-soft">Nothing logged yet.</p> : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className={head}><tr><th className={th}>Date</th><th className={th}>What was done</th><th className={`${th} text-right`}>Km</th><th className={`${th} text-right`}>Cost</th><th /></tr></thead>
                <tbody className="divide-y divide-line">
                  {v.services.map((x) => (
                    <tr key={x.id}>
                      <td className="px-3 py-2">{formatDate(x.serviced_on)}</td>
                      <td className="px-3 py-2"><span className="font-medium">{SERVICE_KINDS[x.kind as keyof typeof SERVICE_KINDS] ?? x.kind}</span> · {x.description}{x.vendor ? <span className="block text-xs text-ink-soft">{x.vendor}</span> : null}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{x.odometer?.toLocaleString("en-NG") ?? "–"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatKobo(x.cost)}{x.expense_id ? <span className="block text-xs text-ink-soft">Booked as expense</span> : null}</td>
                      <td className="px-3 py-2 text-right">{manage && !x.expense_id && <button type="button" className="text-xs font-semibold text-[#c23a3a] hover:underline" onClick={() => { if (window.confirm("Remove this entry?")) removeService.mutate(x.id); }}>Remove</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Recent trips">
            {v.trips.length === 0 ? <p className="text-sm text-ink-soft">No trips yet. Pick this vehicle when you issue stock to a salesperson.</p> : (
              <ul className="divide-y divide-line text-sm">
                {v.trips.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2">
                    <Link href={`/field/trips/view?id=${t.id}`} className="font-semibold text-[#f40009] hover:underline">{t.number}</Link>
                    <span className="text-ink-soft">{t.rep} · {formatDateTime(t.opened_at)}</span>
                    <Badge tone={t.status === "open" ? "warn" : "neutral"}>{t.status === "open" ? "Out" : "Done"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Fuel vouchers">
            {v.fuel_vouchers.length === 0 ? <p className="text-sm text-ink-soft">No fuel vouchers for this vehicle yet.</p> : (
              <ul className="divide-y divide-line text-sm">
                {v.fuel_vouchers.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2">
                    <span><span className="font-medium">{f.number}</span> <span className="text-ink-soft">{f.station}</span></span>
                    <span className="tabular-nums">{f.status === "cancelled" ? `${f.litres ? `${f.litres} L · ` : ""}${formatKobo(f.amount)} (voided)` : `${f.litres ? `${f.litres} L · ` : ""}${formatKobo(f.amount_used ?? f.amount)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {dialog === "edit" && <EditModal v={v} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "service" && <ServiceModal id={id} odometer={v.odometer} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog && typeof dialog === "object" && <DocModal id={id} doc={dialog.doc === "new" ? null : dialog.doc} onClose={() => setDialog(null)} onDone={refresh} />}
    </>
  );
}

function formFrom(v: VehicleDetail): Record<string, string> {
  return {
    reg_no: v.reg_no, nickname: str(v.nickname), type: v.type, fuel_type: v.fuel_type, make: str(v.make), model: str(v.model), year: str(v.year), color: str(v.color),
    capacity_crates: str(v.capacity_crates), odometer: str(v.odometer), chassis_no: str(v.chassis_no), engine_no: str(v.engine_no), branch_id: str(v.branch_id), default_driver_id: str(v.default_driver_id),
  };
}

function EditModal({ v, onClose, onDone }: { v: VehicleDetail; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState(formFrom(v));
  const [status, setStatus] = useState<string>(v.status);
  const set = (k: string) => (val: string) => setF((p) => ({ ...p, [k]: val }));
  const save = useMutation({
    mutationFn: () => api(`/vehicles/${v.id}`, { method: "PUT", body: { ...vehicleBody(f), status } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title={`Edit ${v.reg_no}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <VehicleFormFields f={f} set={set} />
        <SelectField label="Status" value={status} onChange={setStatus} options={Object.entries(VEHICLE_STATUS).map(([value, label]) => ({ value, label }))} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function DocModal({ id, doc, onClose, onDone }: { id: string; doc: VehicleDoc | null; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState(doc?.kind ?? "insurance");
  const [reference, setReference] = useState(doc?.reference ?? "");
  const [issued, setIssued] = useState(doc?.issued_on ?? "");
  const [expires, setExpires] = useState(doc?.expires_on ?? "");
  const save = useMutation({
    mutationFn: () => api(doc ? `/vehicle-documents/${doc.id}` : `/vehicles/${id}/documents`, { method: doc ? "PUT" : "POST", body: { kind, reference: reference || null, issued_on: issued || null, expires_on: expires || null } }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title={doc ? "Edit paper" : "Add paper"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Kind" value={kind} onChange={setKind} options={Object.entries(DOC_KINDS).map(([value, label]) => ({ value, label }))} />
        <Field label="Policy / certificate number" value={reference} onChange={(e) => setReference(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issued on" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
          <Field label="Expires on" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function ServiceModal({ id, odometer, onClose, onDone }: { id: string; odometer: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ serviced_on: new Date().toISOString().slice(0, 10), kind: "service", description: "", vendor: "", odometer: String(odometer || ""), cost: "", method: "cash" });
  const [book, setBook] = useState(true);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const cost = nairaToKobo(f.cost);

  const save = useMutation({
    mutationFn: () => api(`/vehicles/${id}/services`, {
      method: "POST",
      body: { serviced_on: f.serviced_on, kind: f.kind, description: f.description, vendor: f.vendor || null, odometer: f.odometer ? Number(f.odometer) : null, cost, book_expense: book && cost > 0, method: f.method },
    }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <Modal title="Log service or repair" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={f.serviced_on} onChange={(e) => set("serviced_on")(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
          <SelectField label="Kind" value={f.kind} onChange={set("kind")} options={Object.entries(SERVICE_KINDS).map(([value, label]) => ({ value, label }))} />
        </div>
        <Field label="What was done" value={f.description} onChange={(e) => set("description")(e.target.value)} placeholder="e.g. Brake pads replaced" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Workshop / vendor" value={f.vendor} onChange={(e) => set("vendor")(e.target.value)} />
          <Field label="Odometer (km)" inputMode="numeric" value={f.odometer} onChange={(e) => set("odometer")(e.target.value.replace(/\D/g, ""))} />
        </div>
        <MoneyField label="Cost" value={f.cost} onChange={set("cost")} />
        {cost > 0 && (
          <div className="space-y-2 rounded-xl border border-line p-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={book} onChange={(e) => setBook(e.target.checked)} className="size-4" /> Also record this as a vehicle repairs expense</label>
            {book && <SelectField label="Paid from" value={f.method} onChange={set("method")} options={[{ value: "cash", label: "Cash on hand" }, { value: "bank", label: "Bank" }]} />}
          </div>
        )}
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!f.description}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export default withSuspense(VehiclePage);
