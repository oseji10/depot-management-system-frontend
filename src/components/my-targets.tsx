"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatKobo } from "../lib/format";
import { monthLabel } from "../lib/payroll";
import { progressText } from "../lib/targets";
import type { TargetRep } from "../lib/types";
import { Card } from "./ui";

/** A van salesman's own targets for the month and the reward they are on course for. Hidden when there are none (or with no signal). */
export function MyTargets() {
  const period = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const q = useQuery({ queryKey: ["targets", "mine", period], queryFn: () => api<TargetRep>(`/targets/mine?period=${period}`), retry: false, staleTime: 60_000 });
  const t = q.data;

  if (!t || t.targets.length === 0) return null;

  return (
    <Card className="mb-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">My targets · {monthLabel(period)}</p>
        <p className="text-sm tabular-nums">Reward so far <b>{formatKobo(t.reward_total)}</b> <span className="text-xs text-ink-soft">of {formatKobo(t.reward_full)}</span></p>
      </div>
      <ul className="space-y-3">
        {t.targets.map((x) => (
          <li key={x.id} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{x.product}</span>
              <span className="text-xs text-ink-soft tabular-nums">{progressText(x)} · <b className="text-ink">{x.percent}%</b></span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={Math.round(x.percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`${x.product} progress`}>
              <div className={`h-full rounded-full ${x.payout_percent >= 100 ? "bg-emerald-500" : x.payout_percent > 0 ? "bg-amber-500" : "bg-[#f40009]"}`} style={{ width: `${Math.min(x.percent, 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-soft">{x.payout_percent > 0 ? `Earning ${formatKobo(x.reward)} (${x.payout_percent}% of the reward)` : `${formatKobo(x.reward_full)} if you reach the target`}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
