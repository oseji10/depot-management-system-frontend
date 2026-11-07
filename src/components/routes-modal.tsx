"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import type { Rep } from "../lib/types";
import { RoutePicker } from "./route-picker";
import { Button, ErrorNote, Modal } from "./ui";

/** Change which routes a salesperson covers. */
export function RoutesModal({ rep, onClose }: { rep: Rep; onClose: () => void }) {
  const qc = useQueryClient();
  const [ids, setIds] = useState<number[]>((rep.routes ?? []).map((r) => r.id));
  const save = useMutation({
    mutationFn: () => api(`/reps/${rep.id}`, { method: "PUT", body: { route_ids: ids } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["reps"] }); onClose(); },
  });

  return (
    <Modal title={`Routes for ${rep.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <RoutePicker value={ids} onChange={setIds} />
        <p className="text-xs text-ink-soft">The change reaches their phone the next time it refreshes.</p>
        {save.error && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={save.isPending}>Save routes</Button></div>
      </form>
    </Modal>
  );
}
