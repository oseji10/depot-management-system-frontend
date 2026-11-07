"use client";

import Link from "next/link";
import { useSession } from "../hooks/session";
import { formatDate } from "../lib/format";
import { Button } from "./ui";

const day = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "");

/** Tells the business how its subscription stands. Silent while everything is fine. */
export function SubscriptionBanner() {
  const s = useSession();
  const sub = s.subscription;
  if (!sub || s.isPlatform || sub.mode === "blocked") return null;

  const link = s.can("business.manage") ? <Link href="/subscription" className="ml-2 font-semibold underline">{sub.mode === "readonly" ? "Renew now" : "See plans"}</Link> : <span className="ml-2">Ask the business owner to renew.</span>;

  if (sub.mode === "readonly") {
    return (
      <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#a42e2e] print:hidden">
        Your subscription has ended, so the system is <strong>read-only</strong>: you can look and print but not change anything. Access stops completely on {day(sub.readonly_until)}.{link}
      </div>
    );
  }

  if (!sub.overridden && sub.ends_at && sub.days_left != null && sub.days_left <= (sub.kind === "trial" ? 14 : 7)) {
    return (
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
        {sub.kind === "trial" ? "Free trial" : "Subscription"}: <strong>{sub.days_left} day{sub.days_left === 1 ? "" : "s"} left</strong> (ends {day(sub.ends_at)}).{link}
      </div>
    );
  }

  return null;
}

/** Shown in place of the page when the subscription has been over for too long. */
export function SubscriptionGate() {
  const s = useSession();

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">Subscription ended</h1>
      <p className="mt-2 text-sm text-ink-soft">{s.store?.name} has no active subscription. Your data is safe and nothing has been deleted. Renew to carry on.</p>
      <div className="mt-5">
        {s.can("business.manage") ? <Link href="/subscription"><Button>Renew subscription</Button></Link> : <p className="text-sm">Please ask the business owner to renew.</p>}
      </div>
    </div>
  );
}
