"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProductImage } from "../../../../components/product-image";
import { withSuspense } from "../../../../components/suspense-page";
import { Button, ICON, Svg } from "../../../../components/ui";
import { useIdParam } from "../../../../hooks/id-param";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import { formatDateTime, formatKobo } from "../../../../lib/format";
import type { FuelVoucher } from "../../../../lib/types";

/** A slip for the till printer (80mm roll, A4 works too) with lines for the cashier or manager, the driver and the station to sign. */
function VoucherPrint() {
  const id = useIdParam();
  const s = useSession();
  const doc = useQuery({ queryKey: ["fuel", "voucher", id], queryFn: () => api<FuelVoucher>(`/fuel-vouchers/${id}`) });
  const logoUrl = s.store?.logo_url ?? null;
  const logo = useProductImage(logoUrl);
  const [logoSettled, setLogoSettled] = useState(false);

  useEffect(() => {
    if (!logoUrl) return;
    const t = setTimeout(() => setLogoSettled(true), 4000);
    return () => clearTimeout(t);
  }, [logoUrl]);

  const ready = !!doc.data && (!logoUrl || logoSettled);
  useEffect(() => {
    if (ready && new URLSearchParams(window.location.search).get("print") === "1") setTimeout(() => window.print(), 300);
  }, [ready]);

  if (!doc.data) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;
  const v = doc.data;
  const voided = v.status === "cancelled";
  const line = "mt-7 border-t border-dashed border-black pt-1 text-[11px]";

  return (
    <div>
      <div className="mx-auto mb-5 flex max-w-sm items-center justify-between gap-2 print:hidden">
        <Link href="/fuel" className="text-sm font-semibold text-[#f40009] hover:underline">← Back to fuel</Link>
        <Button onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button>
      </div>

      <article className="voucher-80 mx-auto w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-[13px] shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }
            html, body { width: 80mm !important; margin: 0 !important; background: #fff !important; }
            .voucher-80 { width: 72mm !important; max-width: 72mm !important; margin: 0 4mm !important; padding: 2mm 0 10mm !important; font-size: 12px !important; line-height: 1.25 !important; color: #000 !important; break-inside: avoid; }
            .voucher-80 * { color: #000 !important; border-color: #000 !important; }
            .voucher-80 img { filter: grayscale(1) contrast(1.6); }
          }
        `}</style>

        <header className="text-center">
          {logoUrl && logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" onLoad={() => setLogoSettled(true)} onError={() => setLogoSettled(true)} className="mx-auto mb-2 max-h-14 max-w-[60%] object-contain print:max-h-[14mm]" />
          )}
          <p className="text-base font-bold tracking-tight">{s.store?.name}</p>
          {s.store?.phone && <p className="text-xs text-ink-soft">{s.store.phone}</p>}
          <p className="mt-2 text-sm font-bold tracking-[0.2em] uppercase">Fuel voucher</p>
          <p className="font-mono text-xs">{v.number}</p>
          {voided && <p className="mt-2 inline-block rounded-md border-2 border-[#c23a3a] px-2 py-0.5 text-sm font-bold tracking-widest text-[#c23a3a]">VOID</p>}
        </header>

        <div className="my-3 border-y border-dashed border-line py-3 text-center">
          <p className="text-[11px] tracking-wide text-ink-soft uppercase">Fuel to be supplied</p>
          <p className="text-4xl font-black tracking-tight">{v.litres ? v.litres.toLocaleString("en-NG", { maximumFractionDigits: 2 }) : "–"} <span className="text-xl font-bold">litres</span></p>
          <p className="mt-1 font-mono text-xl font-bold tracking-[0.25em]">{v.code}</p>
        </div>

        <dl className="space-y-0.5 text-xs">
          {([
            ["Station", v.station?.name], ["Driver", v.driver?.name], ["Vehicle", v.vehicle], ["Trip", v.trip?.number], ["Date", formatDateTime(v.created_at)],
            ["Price per litre", v.price_per_litre ? formatKobo(v.price_per_litre) : null], ["Value", formatKobo(v.amount_used ?? v.amount)], ["Note", v.note],
          ] as [string, string | null | undefined][]).filter(([, x]) => x).map(([k, x]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-soft">{k}</dt><dd className="text-right font-medium">{x}</dd></div>
          ))}
        </dl>

        {voided && (
          <div className="mt-3 rounded-lg border border-[#c23a3a] p-2 text-xs">
            <p className="font-bold">Voided{v.voider ? ` by ${v.voider.name}` : ""}{v.cancelled_at ? ` · ${formatDateTime(v.cancelled_at)}` : ""}</p>
            <p>{v.void_reason}</p>
          </div>
        )}

        <div className="mt-4 text-[11px]">
          <p className="text-ink-soft">Issued by {v.issuer?.name ?? "–"}</p>
          <div className={line}>Cashier / Manager (sign &amp; name)</div>
          <div className={line}>Driver (sign &amp; name)</div>
          <div className={line}>Station attendant (litres supplied, sign &amp; stamp)</div>
        </div>
        <p className="mt-4 text-center text-[10px] text-ink-soft">Valid for the litres shown, at the named station only.</p>
      </article>
    </div>
  );
}

export default withSuspense(VoucherPrint);
