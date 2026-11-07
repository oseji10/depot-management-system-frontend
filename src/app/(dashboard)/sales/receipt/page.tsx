"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Receipt } from "../../../../components/receipt";
import { Button, ICON, Svg } from "../../../../components/ui";
import { WhatsAppButton } from "../../../../components/whatsapp-button";
import { usePayTo } from "../../../../hooks/pay-to";
import { saleMessage } from "../../../../lib/share";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import type { Sale } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function ReceiptPage() {
  const id = useIdParam();
  const s = useSession();
  const payTo = usePayTo();
  const doc = useQuery({ queryKey: ["sale", id], queryFn: () => api<Sale>(`/sales/${id}`) });

  // With a logo, wait until it has been drawn; give up after 4 seconds so a slow or offline phone can still print.
  const hasLogo = !!s.store?.logo_url;
  const [logoSettled, setLogoSettled] = useState(false);
  useEffect(() => {
    if (!hasLogo) return;
    const t = setTimeout(() => setLogoSettled(true), 4000);
    return () => clearTimeout(t);
  }, [hasLogo]);
  const ready = !!doc.data && (!hasLogo || logoSettled);

  // The till opens this page with ?print=1 so the print dialog appears straight away.
  useEffect(() => {
    if (ready && new URLSearchParams(window.location.search).get("print") === "1") setTimeout(() => window.print(), 300);
  }, [ready]);

  if (!doc.data) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  return (
    <div>
      <div className="mx-auto mb-5 flex max-w-sm items-center justify-between gap-2 print:hidden">
        <Link href={`/sales/view?id=${id}`} className="text-sm font-semibold text-[#f40009] hover:underline">← Back to sale</Link>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton phone={doc.data.customer?.phone} text={saleMessage(doc.data, s.store?.name ?? "", payTo).text} label={doc.data.status !== "void" && doc.data.balance_due > 0 ? "Send invoice" : "Send on WhatsApp"} />
          <Button onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button>
        </div>
      </div>
      <Receipt sale={doc.data} storeName={s.store?.name ?? ""} onLogoSettled={() => setLogoSettled(true)} />
    </div>
  );
}

export default withSuspense(ReceiptPage);
