"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { nairaToKobo } from "../lib/format";
import { Button, ErrorNote, Field, Modal, MoneyField, SelectField } from "./ui";

/** Running money for a driver's trip. Expenses they log are paid from it, not from the sales they collect. */
export function ImprestModal({ tripId, driver, onClose }: { tripId: number; driver: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () => api(`/trips/${tripId}/imprest`, { method: "POST", body: { amount: nairaToKobo(amount), method, note: note || null } }),
    onSuccess: () => {
      for (const key of ["trip", "trips", "reps", "field", "dashboard"]) queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
  });

  return (
    <Modal title={`Give imprest to ${driver}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-ink-soft">Money for running costs on this trip. Their expenses are charged to it, and what is left (or overspent) is settled when they check in.</p>
        <MoneyField label="Amount" value={amount} onChange={setAmount} required autoFocus />
        <SelectField label="Paid from" value={method} onChange={(v) => setMethod(v as "cash" | "bank")} options={[{ value: "cash", label: "Cash on hand" }, { value: "bank", label: "Bank" }]} />
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={nairaToKobo(amount) <= 0}>Give imprest</Button>
        </div>
      </form>
    </Modal>
  );
}
