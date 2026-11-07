"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, MoneyField, PageHeader, SelectField, Stat, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useOptions } from "../../../hooks/options";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDateTime, formatKobo, nairaToKobo } from "../../../lib/format";
import type { FuelStationRow, FuelVoucher, Paginated } from "../../../lib/types";

const TONE = { issued: "good", redeemed: "good", cancelled: "neutral" } as const;
const LABEL = { issued: "Issued", redeemed: "Used", cancelled: "Voided" } as const;
const litres = (n: number) => `${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })} L`;

export default function FuelPage() {
  const s = useSession();
  const [tab, setTab] = useState<"vouchers" | "stations">("vouchers");
  const [modal, setModal] = useState<null | "station" | "voucher" | { topUp: FuelStationRow } | { void: FuelVoucher } | { issued: FuelVoucher }>(null);
  const [status, setStatus] = useState("");
  const qc = useQueryClient();
  const manage = s.can("fuel.manage");

  const stations = useQuery({ queryKey: ["fuel", "stations"], queryFn: () => api<{ data: FuelStationRow[] }>("/fuel-stations") });
  const vouchers = useQuery({ queryKey: ["fuel", "vouchers", status], queryFn: () => api<Paginated<FuelVoucher>>(`/fuel-vouchers${status ? `?status=${status}` : ""}`) });

  const list = stations.data?.data ?? [];
  const total = list.reduce((n, x) => n + x.balance, 0);
  const totalLitres = list.reduce((n, x) => n + x.litres, 0);
  const th = "px-4 py-2.5 font-medium";
  const head = "border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase";

  return (
    <>
      <PageHeader
        title="Fuel"
        description="Fuel is bought from stations in litres. A voucher is for a number of litres and counts as used once it is issued; if a driver brings one back, void it with a reason and the litres return to the station."
        action={manage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModal("station")}>Add station</Button>
            <Button onClick={() => setModal("voucher")} disabled={!list.length}>Issue voucher</Button>
          </div>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Litres with stations" value={litres(totalLitres)} note={`${list.length} station${list.length === 1 ? "" : "s"}`} />
        <Stat label="Prepaid value" value={formatKobo(total)} note="Money paid in advance" />
      </div>

      <div role="tablist" aria-label="View" className="mb-3 inline-flex rounded-xl border border-line bg-surface p-1 text-sm shadow-sm">
        {(["vouchers", "stations"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`rounded-lg px-4 py-2 ${tab === v ? "bg-gradient-to-b from-[#ff3b3f] to-[#f40009] font-semibold text-white shadow-sm" : "text-ink-soft"}`}>{v === "vouchers" ? "Vouchers" : "Stations"}</button>
        ))}
      </div>

      {tab === "stations" ? (
        <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className={head}><tr><th className={th}>Station</th><th className={`${th} text-right`}>Litres left</th><th className={`${th} text-right`}>Prepaid value</th><th className={`${th} text-right`}>Usual price / L</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-line">
              {stations.isLoading ? <TableLoading cols={5} /> : stations.error ? <TableError cols={5} message={(stations.error as Error).message} />
                : list.length === 0 ? <TableEmpty cols={5} title="No fuel stations yet" hint="Add the stations you have prepaid, then top them up." />
                : list.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3"><p className="font-medium">{x.name} {!x.is_active && <Badge>Off</Badge>}</p><p className="text-xs text-ink-soft">{[x.location, x.phone].filter(Boolean).join(" · ")}</p></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{x.tracks_litres ? litres(x.litres) : <span className="text-xs font-normal text-ink-soft">not tracked yet</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKobo(x.balance)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{x.price_per_litre ? formatKobo(x.price_per_litre) : "–"}</td>
                    <td className="px-4 py-3 text-right">{manage && <Button size="sm" variant="secondary" onClick={() => setModal({ topUp: x })}>Top up</Button>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <label className="sr-only" htmlFor="fv-status">Status</label>
            <select id="fv-status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm">
              <option value="">All vouchers</option><option value="issued">Issued</option><option value="cancelled">Voided</option>
            </select>
          </div>
          <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className={head}><tr><th className={th}>Voucher</th><th className={th}>Driver</th><th className={th}>Station</th><th className={`${th} text-right`}>Litres</th><th className={`${th} text-right`}>Value</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-line">
                {vouchers.isLoading ? <TableLoading cols={7} /> : vouchers.error ? <TableError cols={7} message={(vouchers.error as Error).message} />
                  : (vouchers.data?.data.length ?? 0) === 0 ? <TableEmpty cols={7} title="No vouchers" hint="Issue a voucher so a driver can fill up at a prepaid station." />
                  : vouchers.data!.data.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-3"><p className="font-mono font-semibold">{v.code}</p><p className="text-xs text-ink-soft">{v.number} · {formatDateTime(v.created_at)}{v.vehicle ? ` · ${v.vehicle}` : ""}</p></td>
                      <td className="px-4 py-3">{v.driver?.name}{v.trip ? <span className="block text-xs text-ink-soft">{v.trip.number}</span> : null}</td>
                      <td className="px-4 py-3">{v.station?.name}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{v.litres ? litres(v.litres) : "–"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatKobo(v.amount_used ?? v.amount)}{v.price_per_litre ? <span className="block text-xs text-ink-soft">{formatKobo(v.price_per_litre)} / L</span> : null}</td>
                      <td className="px-4 py-3">
                        <Badge tone={TONE[v.status]}>{LABEL[v.status]}</Badge>
                        {v.status === "cancelled" && v.void_reason && <span className="mt-1 block max-w-48 text-xs text-ink-soft">{v.void_reason}</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/fuel/voucher?id=${v.id}`} className="mr-2 text-sm font-semibold text-[#f40009] hover:underline">{v.status === "cancelled" ? "View" : "Print"}</Link>
                        {manage && v.status === "issued" && <Button size="sm" variant="danger" onClick={() => setModal({ void: v })}>Void</Button>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal === "station" && <StationModal onClose={() => setModal(null)} />}
      {modal === "voucher" && <VoucherModal stations={list.filter((x) => x.is_active)} onClose={() => setModal(null)} onIssued={(v) => setModal({ issued: v })} />}
      {modal && typeof modal === "object" && "topUp" in modal && <TopUpModal station={modal.topUp} onClose={() => setModal(null)} />}
      {modal && typeof modal === "object" && "void" in modal && <VoidModal voucher={modal.void} onClose={() => setModal(null)} />}
      {modal && typeof modal === "object" && "issued" in modal && <IssuedModal voucher={modal.issued} onClose={() => setModal(null)} />}
    </>
  );
}

function useDone(onClose: () => void) {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ["fuel"] }); for (const k of ["reports", "journals", "accounts"]) void qc.invalidateQueries({ queryKey: [k] }); onClose(); };
}

function StationModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(""); const [location, setLocation] = useState(""); const [phone, setPhone] = useState("");
  const done = useDone(onClose);
  const save = useMutation({ mutationFn: () => api("/fuel-stations", { method: "POST", body: { name, location: location || null, phone: phone || null, is_active: true } }), onSuccess: done });

  return (
    <Modal title="Add a fuel station" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Station name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Field label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Field label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending} disabled={!name.trim()}>Add station</Button></div>
      </form>
    </Modal>
  );
}

function TopUpModal({ station, onClose }: { station: FuelStationRow; onClose: () => void }) {
  const [amount, setAmount] = useState(""); const [lit, setLit] = useState(""); const [method, setMethod] = useState<"cash" | "bank">("bank"); const [ref, setRef] = useState("");
  const done = useDone(onClose);
  const save = useMutation({ mutationFn: () => api(`/fuel-stations/${station.id}/top-up`, { method: "POST", body: { amount: nairaToKobo(amount), litres: Number(lit), method, reference: ref || null } }), onSuccess: done });
  const rate = Number(lit) > 0 ? Math.round(nairaToKobo(amount) / Number(lit)) : 0;

  return (
    <Modal title={`Top up ${station.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">{station.tracks_litres ? `${litres(station.litres)} left, ` : ""}{formatKobo(station.balance)} prepaid. Enter what you paid and how many litres it bought.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Amount paid" value={amount} onChange={setAmount} required autoFocus />
          <Field label="Litres bought" inputMode="decimal" value={lit} onChange={(e) => setLit(e.target.value.replace(/[^\d.]/g, ""))} required />
        </div>
        {rate > 0 && <p className="rounded-xl bg-[#fff5f5] px-3 py-2 text-sm">That works out at <b>{formatKobo(rate)}</b> a litre.</p>}
        <SelectField label="Paid from" value={method} onChange={(v) => setMethod(v as "cash" | "bank")} options={[{ value: "bank", label: "Bank" }, { value: "cash", label: "Cash on hand" }]} />
        <Field label="Receipt or transfer reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending} disabled={nairaToKobo(amount) <= 0 || !(Number(lit) > 0)}>Add to station</Button></div>
      </form>
    </Modal>
  );
}

function VoucherModal({ stations, onClose, onIssued }: { stations: FuelStationRow[]; onClose: () => void; onIssued: (v: FuelVoucher) => void }) {
  const drivers = useOptions("/users");
  const vehicles = useOptions("/vehicles", "reg_no");
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [station, setStation] = useState(stations.length === 1 ? String(stations[0].id) : ""); const [driver, setDriver] = useState("");
  const [lit, setLit] = useState(""); const [rate, setRate] = useState(stations.length === 1 && stations[0].price_per_litre ? String(stations[0].price_per_litre / 100) : "");
  const [vehicle, setVehicle] = useState(""); const [note, setNote] = useState("");
  const chosen = stations.find((x) => String(x.id) === station);
  const price = nairaToKobo(rate);
  const value = Math.round(Number(lit || 0) * price);
  const save = useMutation({
    mutationFn: () => api<FuelVoucher>("/fuel-vouchers", { method: "POST", body: { fuel_station_id: Number(station), driver_id: Number(driver), litres: Number(lit), price_per_litre: price || null, vehicle_id: vehicleId ? Number(vehicleId) : null, vehicle: vehicle || null, note: note || null } }),
    onSuccess: (v) => { void qc.invalidateQueries({ queryKey: ["fuel"] }); for (const k of ["reports", "journals", "accounts"]) void qc.invalidateQueries({ queryKey: [k] }); onIssued(v); },
  });

  return (
    <Modal title="Issue a fuel voucher" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <SelectField label="Station" value={station} onChange={(v) => { setStation(v); const st = stations.find((x) => String(x.id) === v); if (st?.price_per_litre) setRate(String(st.price_per_litre / 100)); }} required
          options={[{ value: "", label: "Choose…" }, ...stations.map((x) => ({ value: x.id, label: `${x.name}${x.tracks_litres ? ` · ${litres(x.litres)} left` : ""}` }))]} />
        <SelectField label="Driver" value={driver} onChange={setDriver} required options={[{ value: "", label: "Choose…" }, ...drivers]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Litres" inputMode="decimal" value={lit} onChange={(e) => setLit(e.target.value.replace(/[^\d.]/g, ""))} required hint={chosen?.tracks_litres ? `${litres(chosen.litres)} available at this station.` : undefined} />
          <MoneyField label="Price per litre" value={rate} onChange={setRate} required hint={chosen?.price_per_litre ? "The station's usual price. Change it if today's differs." : undefined} />
        </div>
        {value > 0 && <p className="rounded-xl bg-[#fff5f5] px-3 py-2 text-sm">Value of this voucher: <b>{formatKobo(value)}</b>. It comes off the station's balance as soon as it is issued.</p>}
        {vehicles.length > 0
          ? <SelectField label="Vehicle (optional)" value={vehicleId} onChange={setVehicleId} options={[{ value: "", label: "Their trip's vehicle, or none" }, ...vehicles]} />
          : <Field label="Vehicle (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Defaults to their van" />}
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending} disabled={!station || !driver || !(Number(lit) > 0) || price <= 0}>Issue voucher</Button></div>
      </form>
    </Modal>
  );
}

function IssuedModal({ voucher, onClose }: { voucher: FuelVoucher; onClose: () => void }) {
  return (
    <Modal title="Voucher issued" onClose={onClose}>
      <div className="text-center">
        <p className="font-mono text-3xl font-bold tracking-widest">{voucher.code}</p>
        <p className="mt-2 text-2xl font-bold">{voucher.litres ? litres(voucher.litres) : ""}</p>
        <p className="mt-1 text-sm text-ink-soft">{voucher.number} · {voucher.driver?.name} · {voucher.station?.name}</p>
        <p className="mt-3 text-xs text-ink-soft">Print it on the till printer for the cashier or manager to sign.</p>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link href={`/fuel/voucher?id=${voucher.id}&print=1`} target="_blank" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff3b3f] to-[#f40009] px-4 text-sm font-semibold text-white shadow-sm">Print voucher</Link>
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

function VoidModal({ voucher, onClose }: { voucher: FuelVoucher; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const done = useDone(onClose);
  const save = useMutation({ mutationFn: () => api(`/fuel-vouchers/${voucher.id}/void`, { method: "POST", body: { reason: reason.trim() } }), onSuccess: done });

  return (
    <Modal title={`Void voucher ${voucher.code}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">
          {voucher.driver?.name} at {voucher.station?.name}: {voucher.litres ? litres(voucher.litres) : ""} worth {formatKobo(voucher.amount_used ?? voucher.amount)}. Voiding puts the litres and the money back with the station. The voucher stays on record with your reason.
        </p>
        <Field label="Why is it being voided?" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Driver returned it unused" required autoFocus />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Keep voucher</Button><Button type="submit" variant="danger" busy={save.isPending} disabled={reason.trim().length < 3}>Void voucher</Button></div>
      </form>
    </Modal>
  );
}
