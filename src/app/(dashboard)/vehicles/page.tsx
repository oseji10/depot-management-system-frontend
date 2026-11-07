"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, ErrorNote, Modal, PageHeader, SearchBox, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { VehicleFormFields, vehicleBody } from "../../../components/vehicle-form";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { FUEL_TYPES, VEHICLE_STATUS, VEHICLE_TONE, VEHICLE_TYPES } from "../../../lib/vehicles";
import type { VehicleRow } from "../../../lib/types";

export default function VehiclesPage() {
  const s = useSession();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: ["vehicles", search], queryFn: () => api<{ data: VehicleRow[] }>(`/vehicles?search=${encodeURIComponent(search)}`) });
  const th = "px-4 py-3.5 font-semibold";
  const rows = list.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Your trucks and vans: registration details, papers that expire, services and repairs, and which trips and fuel they have used."
        action={s.can("vehicles.manage") && <Button onClick={() => setOpen(true)}>Add vehicle</Button>}
      />
      <div className="mb-3"><SearchBox value={search} onChange={setSearch} placeholder="Search by plate, name or make" /></div>
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Vehicle</th><th className={th}>Type</th><th className={th}>Usual driver</th><th className={th}>Status</th><th className={th}>Papers</th><th className={th}><span className="sr-only">Open</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.isLoading ? <TableLoading cols={6} /> : list.error ? <TableError cols={6} message={(list.error as Error).message} />
              : rows.length === 0 ? <TableEmpty cols={6} title="No vehicles yet" hint="Add your trucks and vans so trips, fuel and repairs can be tied to them." />
              : rows.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3"><p className="font-semibold">{v.reg_no}</p><p className="text-xs text-ink-soft">{[v.nickname, [v.make, v.model].filter(Boolean).join(" "), v.branch?.name].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-4 py-3">{VEHICLE_TYPES[v.type]}<span className="block text-xs text-ink-soft">{FUEL_TYPES[v.fuel_type]}{v.capacity_crates ? ` · ${v.capacity_crates} crates` : ""}</span></td>
                  <td className="px-4 py-3">{v.driver?.name ?? "–"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={VEHICLE_TONE[v.status]}>{VEHICLE_STATUS[v.status]}</Badge>
                    {v.open_trip && <Link href={`/field/trips/view?id=${v.open_trip.id}`} className="mt-1 block text-xs font-semibold text-[#f40009] hover:underline">On {v.open_trip.number}{v.open_trip.rep ? ` · ${v.open_trip.rep}` : ""}</Link>}
                  </td>
                  <td className="px-4 py-3">
                    {(v.docs_expired ?? 0) > 0 ? <Badge tone="bad">{v.docs_expired} expired</Badge> : (v.docs_soon ?? 0) > 0 ? <Badge tone="warn">{v.docs_soon} expiring soon</Badge> : <span className="text-ink-soft">OK</span>}
                  </td>
                  <td className="px-4 py-3 text-right"><Link href={`/vehicles/view?id=${v.id}`} className="font-semibold text-[#f40009] hover:underline">Open</Link></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && <VehicleModal onClose={() => setOpen(false)} />}
    </>
  );
}

function VehicleModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({ reg_no: "", nickname: "", type: "truck", fuel_type: "diesel", make: "", model: "", year: "", color: "", capacity_crates: "", odometer: "", chassis_no: "", engine_no: "", branch_id: "", default_driver_id: "" });
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => api<{ id: number }>("/vehicles", { method: "POST", body: vehicleBody(f) }),
    onSuccess: (v) => { qc.invalidateQueries({ queryKey: ["vehicles"] }); router.push(`/vehicles/view?id=${v.id}`); },
  });

  return (
    <Modal title="Add vehicle" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <VehicleFormFields f={f} set={set} />
        <p className="text-sm text-ink-soft">After saving you can add the insurance, roadworthiness and licence dates.</p>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!f.reg_no || !f.branch_id}>Save vehicle</Button>
        </div>
      </form>
    </Modal>
  );
}
