"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import { API_URL, authHeaders } from "../lib/auth";
import type { ReceiptFile } from "../lib/types";
import { Button, Card, ErrorNote } from "./ui";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX = 8 * 1024 * 1024;

const sizeText = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export async function uploadReceiptFile(receiptId: number, file: File): Promise<ReceiptFile> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_URL}/goods-receipts/${receiptId}/files`, { method: "POST", headers: authHeaders(), body });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.errors?.file?.[0] ?? data?.message ?? "The file could not be uploaded.");
  return data as ReceiptFile;
}

/** Files are private: fetch with the sign-in token, then show the local copy in a new tab. */
async function openFile(receiptId: number, f: ReceiptFile) {
  const tab = window.open("", "_blank"); // opened first so the browser does not treat it as a pop-up
  try {
    const res = await fetch(`${API_URL}/goods-receipts/${receiptId}/files/${f.id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Could not open the file.");
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    alert((e as Error).message);
  }
}

function tooBig(files: File[]): string | null {
  const big = files.find((f) => f.size > MAX);
  return big ? `${big.name} is larger than 8 MB.` : null;
}

function Picker({ onPick, busy, label }: { onPick: (files: File[]) => void; busy?: boolean; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) onPick(f); }} />
      <Button type="button" variant="secondary" size="sm" busy={busy} onClick={() => ref.current?.click()}>{label}</Button>
    </>
  );
}

/** On the receipt page: what is attached, with view, delete and add. */
export function ReceiptFiles({ receiptId, files, canEdit }: { receiptId: number; files: ReceiptFile[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["goods-receipt", String(receiptId)] });

  const add = useMutation({
    mutationFn: async (picked: File[]) => { for (const f of picked) await uploadReceiptFile(receiptId, f); },
    onSuccess: () => { setError(null); void refresh(); },
    onError: (e: Error) => { setError(e.message); void refresh(); },
  });
  const remove = useMutation({ mutationFn: (id: number) => api(`/goods-receipts/${receiptId}/files/${id}`, { method: "DELETE" }), onSuccess: () => void refresh() });

  return (
    <Card title="Manufacturer's invoice / receipt" action={canEdit && <Picker label="Add a photo or PDF" busy={add.isPending} onPick={(f) => { const m = tooBig(f); if (m) setError(m); else { setError(null); add.mutate(f); } }} />} className="mt-5">
      {files.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-soft">Nothing attached yet.{canEdit ? " Add a photo or PDF of the invoice or receipt that came with the goods." : ""}</p>
      ) : (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <button type="button" onClick={() => void openFile(receiptId, f)} className="min-w-0 text-left font-semibold text-[#f40009] hover:underline">
                <span className="block truncate">{f.original_name}</span>
                <span className="block text-xs font-normal text-ink-soft">{f.mime === "application/pdf" ? "PDF" : "Photo"} · {sizeText(f.size)}</span>
              </button>
              {canEdit && <button type="button" onClick={() => { if (window.confirm(`Remove ${f.original_name}?`)) remove.mutate(f.id); }} className="text-xs font-semibold text-[#c23a3a] hover:underline">Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {error && <div className="px-5 pb-4"><ErrorNote>{error}</ErrorNote></div>}
    </Card>
  );
}

/** On the new-receipt form: pick files now, they are uploaded as soon as the receipt is saved. */
export function StagedFiles({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Manufacturer&apos;s invoice / receipt <span className="font-normal text-ink-soft">(optional)</span></span>
        <Picker label="Add a photo or PDF" onPick={(f) => { const m = tooBig(f); if (m) setError(m); else { setError(null); onChange([...files, ...f].slice(0, 10)); } }} />
      </div>
      {files.length === 0 && <p className="text-xs text-ink-soft">Attach the invoice or receipt that came with the goods. You can also add it later from the receipt.</p>}
      <ul className="space-y-1">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{f.name} <span className="text-xs text-ink-soft">· {sizeText(f.size)}</span></span>
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-xs font-semibold text-[#c23a3a] hover:underline">Remove</button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-[#c23a3a]">{error}</p>}
    </div>
  );
}
