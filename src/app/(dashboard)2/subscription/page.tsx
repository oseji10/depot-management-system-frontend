"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Badge, Button, Card, ErrorNote, PageHeader, TableCard, theadClass, thClass } from "../../../components/ui";
import { api } from "../../../lib/api";
import { formatDate, formatKobo } from "../../../lib/format";
import type { MySubscription } from "../../../lib/types";

const day = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "–");

export default function SubscriptionPage() {
  const q = useQuery({ queryKey: ["my-subscription"], queryFn: () => api<MySubscription>("/subscription") });
  const checkout = useMutation({ mutationFn: (planId: number) => api<{ url: string }>("/subscription/checkout", { method: "POST", body: { plan_id: planId } }), onSuccess: (r) => { window.location.href = r.url; } });

  // Coming back from Paystack: confirm the payment, then reload so the whole app sees the new dates.
  const verify = useMutation({
    mutationFn: (reference: string) => api("/subscription/verify", { method: "POST", body: { reference } }),
    onSuccess: () => { window.location.replace("/subscription/"); },
  });
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("reference") ?? new URLSearchParams(window.location.search).get("trxref");
    if (ref && !verify.isPending && !verify.isSuccess && !verify.isError) verify.mutate(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = q.data;
  const sub = d?.subscription;
  const tone = sub?.mode === "full" ? "good" : sub?.mode === "readonly" ? "warn" : "bad";
  const label = sub ? (sub.overridden ? "Active (set by your provider)" : sub.mode === "full" ? (sub.kind === "trial" ? "Free trial" : "Active") : sub.mode === "readonly" ? "Ended: read-only" : "Ended: blocked") : "";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Subscription" description="Your plan, when it ends, and how to renew." />
      {verify.isPending && <p className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">Confirming your payment…</p>}
      {verify.isError && <div className="mb-4"><ErrorNote>{(verify.error as Error).message} If you were charged, it will be applied automatically within a few minutes.</ErrorNote></div>}
      {q.error && <ErrorNote>{(q.error as Error).message}</ErrorNote>}

      {sub && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Status</p>
              <p className="mt-0.5 text-xl font-bold"><Badge tone={tone}>{label}</Badge></p>
            </div>
            <div className="text-right text-sm">
              {sub.ends_at ? <><p className="text-ink-soft">{sub.mode === "full" ? "Ends" : "Ended"}</p><p className="font-semibold">{day(sub.ends_at)}{sub.mode === "full" && sub.days_left != null ? ` · ${sub.days_left} days left` : ""}</p></> : <p className="font-semibold">No end date</p>}
              {sub.mode === "readonly" && <p className="text-xs text-[#a42e2e]">Access stops on {day(sub.readonly_until)}</p>}
            </div>
          </div>
          {sub.override_note && <p className="mt-3 text-xs text-ink-soft">Note from your provider: {sub.override_note}</p>}
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Renew or upgrade</h2>
      {d && d.plans.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-ink-soft">No plans are on offer yet. Contact your provider to renew.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {d?.plans.map((p) => (
          <Card key={p.id}>
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1 text-2xl font-bold">{formatKobo(p.price)} <span className="text-sm font-normal text-ink-soft">/ {p.months === 1 ? "month" : `${p.months} months`}</span></p>
            {p.description && <p className="mt-1 text-sm text-ink-soft">{p.description}</p>}
            <p className="mt-1 text-xs text-ink-soft">Up to {p.max_businesses} business{p.max_businesses === 1 ? "" : "es"}</p>
            <div className="mt-4">
              {d.online ? <Button busy={checkout.isPending && checkout.variables === p.id} onClick={() => checkout.mutate(p.id)}>Pay online</Button> : <p className="text-xs text-ink-soft">Pay your provider by transfer and they will record it.</p>}
            </div>
          </Card>
        ))}
      </div>
      {checkout.error && <div className="mt-3"><ErrorNote>{(checkout.error as Error).message}</ErrorNote></div>}
      <p className="mt-3 text-xs text-ink-soft">Paying early adds time on top of what you have left; nothing is lost.</p>

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">Payments</h2>
      <TableCard min="34rem">
        <thead className={theadClass}><tr><th scope="col" className={`${thClass} px-5`}>Date</th><th scope="col" className={thClass}>Covers</th><th scope="col" className={thClass}>How</th><th scope="col" className={`${thClass} text-right`}>Amount</th></tr></thead>
        <tbody className="divide-y divide-line">
          {d && d.payments.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-ink-soft">No payments yet.</td></tr>}
          {d?.payments.map((p) => (
            <tr key={p.id}><td className="px-5 py-3">{day(p.paid_at)}</td><td className="px-4 py-3 text-ink-soft">{day(p.period_from)} to {day(p.period_to)}</td><td className="px-4 py-3 capitalize">{p.method}{p.reference ? ` · ${p.reference}` : ""}</td><td className="px-4 py-3 text-right font-semibold">{formatKobo(p.amount)}</td></tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
