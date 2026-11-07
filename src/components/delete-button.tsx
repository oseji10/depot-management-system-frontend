"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui";

/**
 * Deletes a record after a confirmation. Deleted records are hidden, not destroyed, and the server refuses (with the reason shown here)
 * when the record has already been used by something real.
 */
export function DeleteButton({ path, noun, onDone, size = "md", label = "Delete" }: { path: string; noun: string; onDone: () => void; size?: "sm" | "md"; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => api(path, { method: "DELETE" }),
    onSuccess: () => { setError(null); onDone(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" size={size} variant="danger" busy={remove.isPending}
        onClick={() => { if (window.confirm(`Delete this ${noun}? It will be hidden from the system. If it has already been used, it cannot be deleted.`)) remove.mutate(); }}>
        {label}
      </Button>
      {error && <span role="alert" className="max-w-xs text-xs text-[#c23a3a]">{error}</span>}
    </span>
  );
}
