"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOptions } from "../hooks/options";
import { ApiError, api } from "../lib/api";
import type { TripReport } from "../lib/types";
import { emptyLine, LinesEditor, type StockLine } from "./lines-editor";
import { Button, ErrorNote, Field, Modal, SelectField } from "./ui";

/**
 * Loads stock onto a salesperson's van. The first load opens their trip; later ones top it up.
 * Quantities are entered the way the depot counts: crates, bottles, whatever the product is sold in.
 */
export function IssueStockModal({ rep, reps, onClose, onIssued }: {
  rep?: { id: number; name: string };
  reps: { id: number; name: string }[];
  onClose: () => void;
  onIssued?: (r: TripReport) => void;
}) {
  const queryClient = useQueryClient();
  const warehouses = useOptions("/warehouses");
  const [repId, setRepId] = useState(rep ? String(rep.id) : "");
  const vehicles = useOptions("/vehicles", "reg_no");
  const [vehicleId, setVehicleId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockLine[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Card machines nobody else is carrying (or that this salesperson already has)
  const machines = useQuery({ queryKey: ["trip-terminals", repId], enabled: !!repId, queryFn: () => api<{ data: { id: number; name: string; provider: string | null; with_rep: boolean; kept?: boolean }[] }>(`/trips/terminals?rep_id=${repId}`) });
  const machineList = machines.data?.data ?? [];
  const chosenTerminal = terminalId || String(machineList.find((m) => m.with_rep)?.id ?? "");

  const chosenFrom = from || (warehouses.length === 1 ? String(warehouses[0].value) : "");
  const filled = lines.filter((l) => l.product && Number(l.qty) > 0);

  const issue = useMutation({
    mutationFn: () =>
      api<TripReport>("/trips/issue", {
        method: "POST",
        body: {
          rep_id: Number(repId), from_warehouse_id: Number(chosenFrom), vehicle_id: vehicleId ? Number(vehicleId) : null, pos_terminal_id: chosenTerminal ? Number(chosenTerminal) : null, note: note || null,
          lines: filled.map((l) => ({
            product_id: l.product!.id,
            unit_id: Number(l.unitId || l.product!.units.find((u) => u.is_base)?.unit_id),
            quantity: Number(l.qty),
          })),
        },
      }),
    onSuccess: (r) => {
      for (const key of ["reps", "trips", "trip", "stock", "dashboard", "field"]) queryClient.invalidateQueries({ queryKey: [key] });
      onIssued?.(r);
      onClose();
    },
    onError: (e: Error) => setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}),
  });

  const problem = errors.rep_id?.[0] ?? errors.pos_terminal_id?.[0] ?? errors.from_warehouse_id?.[0] ?? errors.lines?.[0] ?? (issue.error && !Object.keys(errors).length ? (issue.error as Error).message : null);
  const ready = !!repId && !!chosenFrom && filled.length > 0;

  return (
    <Modal title="Issue stock" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); issue.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">The stock moves onto the salesperson’s van straight away. They can then sell it from their phone, and what is left comes back at check-in.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Salesperson" value={repId} onChange={setRepId} error={errors.rep_id?.[0]} required
            options={[{ value: "", label: "Choose…" }, ...reps.map((r) => ({ value: r.id, label: r.name }))]} />
          <SelectField label="Take stock from" value={chosenFrom} onChange={setFrom} error={errors.from_warehouse_id?.[0]} required
            options={[{ value: "", label: "Choose…" }, ...warehouses]} />
          <SelectField label="Vehicle (optional)" value={vehicleId} onChange={setVehicleId} error={errors.vehicle_id?.[0]}
            options={[{ value: "", label: "Not recorded" }, ...vehicles]} />
          {machineList.some((m) => m.kept && m.with_rep) ? (
            <p className="rounded-xl bg-paper px-3 py-2 text-sm"><span className="font-medium">POS terminal:</span> {machineList.find((m) => m.kept && m.with_rep)?.name} <span className="text-ink-soft">· assigned to this salesperson, goes out with this load</span></p>
          ) : machineList.length > 0 && (
            <SelectField label="POS terminal (optional)" value={chosenTerminal} onChange={setTerminalId} error={errors.pos_terminal_id?.[0]}
              hint="The machine they carry. Their card payments and POS transfers are tied to it until the trip is checked in."
              options={[{ value: "", label: "None" }, ...machineList.map((m) => ({ value: m.id, label: `${m.name}${m.provider ? ` · ${m.provider}` : ""}${m.with_rep ? " (already with them)" : ""}` }))]} />
          )}
        </div>

        <LinesEditor lines={lines} setLines={setLines} errors={errors} />

        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Karu route, morning load" />

        {problem && <ErrorNote>{problem}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={issue.isPending} disabled={!ready}>Issue stock</Button>
        </div>
      </form>
    </Modal>
  );
}
