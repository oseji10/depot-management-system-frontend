"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, ErrorNote, Field, Modal, PageHeader, TableEmpty, TableError, TableLoading } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import type { Paginated, PriceList } from "../../../lib/types";

const today = () => new Date().toISOString().slice(0, 10);

function phase(l: PriceList): "off" | "scheduled" | "running" | "ended" {
  if (!l.is_active) return "off";
  if (l.starts_on && l.starts_on > today()) return "scheduled";
  if (l.ends_on && l.ends_on < today()) return "ended";
  return "running";
}

const TONE = { running: "good", scheduled: "warn", ended: "neutral", off: "neutral" } as const;
const LABEL = { running: "Running now", scheduled: "Scheduled", ended: "Ended", off: "Switched off" } as const;

export default function PromotionsPage() {
  const s = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const lists = useQuery({ queryKey: ["promotions"], queryFn: () => api<Paginated<PriceList>>("/price-lists?per_page=100") });
  const toggle = useMutation({
    mutationFn: (l: PriceList) => api(`/price-lists/${l.id}`, { method: "PUT", body: { name: l.name, type: l.type, starts_on: l.starts_on, ends_on: l.ends_on, priority: l.priority, is_default: false, is_active: !l.is_active } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["promotions"] }); qc.invalidateQueries({ queryKey: ["list", "/price-lists"] }); },
  });

  const promos = (lists.data?.data ?? []).filter((l) => l.type === "promo");
  const th = "px-4 py-3.5 font-semibold";

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Run a promo price for a set time. Customers are charged the promo price at the till automatically while it runs, and the normal price comes back by itself afterwards."
        action={s.can("pricing.manage") && <Button onClick={() => setOpen(true)}>New promotion</Button>}
      />
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className={th}>Promotion</th><th className={th}>Runs</th><th className={th}>Products</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lists.isLoading ? <TableLoading cols={5} /> : lists.error ? <TableError cols={5} message={(lists.error as Error).message} />
              : promos.length === 0 ? <TableEmpty cols={5} title="No promotions yet" hint="Create one, then choose which products get a promo price." />
              : promos.map((l) => {
                const p = phase(l);
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium">{l.name}</td>
                    <td className="px-4 py-3">{l.starts_on ? `${formatDate(l.starts_on)} – ${l.ends_on ? formatDate(l.ends_on) : "no end date"}` : "Starts straight away"}</td>
                    <td className="px-4 py-3">{l.prices_count ?? 0}</td>
                    <td className="px-4 py-3"><Badge tone={TONE[p]}>{LABEL[p]}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/price-lists/view?id=${l.id}`} className="mr-3 font-semibold text-[#f40009] hover:underline">{s.can("pricing.manage") ? "Set prices" : "View prices"}</Link>
                      {s.can("pricing.manage") && p !== "ended" && (
                        <Button size="sm" variant="secondary" busy={toggle.isPending} onClick={() => toggle.mutate(l)}>{l.is_active ? "Switch off" : "Switch on"}</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {open && <NewPromo onClose={() => setOpen(false)} />}
    </>
  );
}

function NewPromo({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");

  const create = useMutation({
    mutationFn: () => api<PriceList>("/price-lists", { method: "POST", body: { name, type: "promo", starts_on: from, ends_on: to || null, priority: 10, is_default: false, is_active: true } }),
    onSuccess: (l) => { qc.invalidateQueries({ queryKey: ["promotions"] }); router.push(`/price-lists/view?id=${l.id}`); },
  });

  return (
    <Modal title="New promotion" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. December festive offer" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts on" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          <Field label="Ends on" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} hint="Leave empty for no end date." />
        </div>
        <p className="text-sm text-ink-soft">Next you choose which products get a promo price. Products you leave out stay at their normal price.</p>
        {create.error && <ErrorNote>{(create.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={create.isPending}>Continue to prices</Button>
        </div>
      </form>
    </Modal>
  );
}
