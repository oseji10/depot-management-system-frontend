"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "../hooks/session";
import { api } from "../lib/api";
import { formatDate, formatKobo } from "../lib/format";
import type { Proforma, TerminalChoice, TransferAccount } from "../lib/types";
import { useProductImage } from "./product-image";

const DARK = "#2a1416";
const RED = "#f40009";

/** "Coke 50cl · Crate" → ["Coke 50cl", "Crate"]; a typed line has no unit. */
function split(description: string): [string, string] {
  const at = description.lastIndexOf(" · ");
  return at === -1 ? [description, "–"] : [description.slice(0, at), description.slice(at + 3)];
}

/**
 * The proforma invoice as an A4 document: business block and title on top, who it is for, the items in a table with a
 * dark header, the totals, how to pay (the business's bank accounts) and a closing band. Colours print as shown.
 */
export function ProformaDocument({ p }: { p: Proforma }) {
  const { store, can } = useSession();
  const logo = useProductImage(store?.logo_url ?? null);
  const banks = useQuery({
    queryKey: ["terminals", "available", undefined], enabled: can("sales.create") || can("proformas.manage"), staleTime: 5 * 60_000,
    queryFn: () => api<{ data: TerminalChoice[]; accounts?: TransferAccount[] }>("/pos-terminals/available"),
  });
  const accounts = (banks.data?.accounts ?? []).filter((a) => a.account_number).slice(0, 3);
  const qty = (p.lines ?? []).reduce((n, l) => n + l.quantity, 0);

  const meta: [string, string][] = [
    ["Proforma number", p.number],
    ...(p.valid_until ? [["Valid until", formatDate(p.valid_until)] as [string, string]] : []),
    ["Currency", "NGN (₦)"],
    ["Items", `${p.lines?.length ?? 0} line${p.lines?.length === 1 ? "" : "s"} · ${qty.toLocaleString("en-NG")} in all`],
  ];

  return (
    <article className="proforma mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line bg-white text-[13px] text-[#1d1213] shadow-sm print:max-w-none print:rounded-none print:border-0 print:pb-16 print:shadow-none">
      <style>{`@media print { @page { size: A4; margin: 10mm; } html, body { background: #fff !important; } .proforma, .proforma * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="px-8 pt-8 print:px-2 print:pt-2">
        {/* Business and title */}
        <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="" className="mb-3 max-h-20 max-w-[60%] object-contain" />}
            <p className="text-lg font-black">{store?.name}</p>
            {store?.address && <p>{store.address}</p>}
            {store?.email && <p>{store.email}</p>}
            {store?.phone && <p>{store.phone}</p>}
          </div>
          <div className="border-l-4 pl-5" style={{ borderColor: DARK }}>
            <p className="text-4xl leading-none font-black tracking-tight" style={{ color: DARK }}>PROFORMA<br />INVOICE</p>
            <dl className="mt-4 grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1">
              {meta.map(([k, v]) => (
                <div key={k} className="contents"><dt className="font-bold" style={{ color: DARK }}>{k}</dt><dd>:</dd><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>

        {/* Who it is for */}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-lg border border-[#e4dcdc] p-4">
            <p className="mb-2 text-[15px] font-extrabold tracking-wide" style={{ color: DARK }}>BILL TO</p>
            <p className="font-bold">{p.customer_name}</p>
            {p.customer_phone && <p>{p.customer_phone}</p>}
            {p.customer_email && <p>{p.customer_email}</p>}
            {p.customer_address && <p>{p.customer_address}</p>}
          </div>
          <div className="rounded-lg border border-[#e4dcdc] p-4">
            <p className="mb-2 text-[15px] font-extrabold tracking-wide" style={{ color: DARK }}>QUOTE DETAILS</p>
            <p><span className="font-bold">Total to pay</span>&nbsp; {formatKobo(p.total)}</p>
            <p><span className="font-bold">Valid</span>&nbsp; {p.valid_until ? `until ${formatDate(p.valid_until)}` : "until stock or prices change"}</p>
            <p className="mt-1 text-xs text-[#7a6868]">This is a quotation, not a receipt.</p>
          </div>
        </div>

        {/* Items */}
        <table className="mt-6 w-full border-collapse border border-[#e4dcdc] text-left">
          <thead style={{ background: DARK }} className="text-white">
            <tr className="text-xs font-bold tracking-wide uppercase">
              <th className="px-3 py-3">Description</th>
              <th className="border-l border-white/30 px-3 py-3 text-center">Qty</th>
              <th className="border-l border-white/30 px-3 py-3 text-center">Unit</th>
              <th className="border-l border-white/30 px-3 py-3 text-right">Rate (₦)</th>
              <th className="border-l border-white/30 px-3 py-3 text-right">Amount (₦)</th>
            </tr>
          </thead>
          <tbody>
            {p.lines?.map((l) => {
              const [what, unit] = split(l.description);
              return (
                <tr key={l.id} className="border-b border-[#e4dcdc] align-top">
                  <td className="px-3 py-3 font-semibold">{what}</td>
                  <td className="border-l border-[#e4dcdc] px-3 py-3 text-center">{l.quantity.toLocaleString("en-NG")}</td>
                  <td className="border-l border-[#e4dcdc] px-3 py-3 text-center">{unit}</td>
                  <td className="border-l border-[#e4dcdc] px-3 py-3 text-right tabular-nums">{formatKobo(l.unit_price)}</td>
                  <td className="border-l border-[#e4dcdc] px-3 py-3 text-right tabular-nums">{formatKobo(l.line_total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Notes and totals */}
        <div className="grid border-x border-b border-[#e4dcdc] sm:grid-cols-2 print:grid-cols-2">
          <div className="p-4">
            {p.notes && <p className="whitespace-pre-line">{p.notes}</p>}
            {p.terms && <><p className="mt-2 text-xs font-bold tracking-wide uppercase" style={{ color: DARK }}>Terms</p><p className="whitespace-pre-line">{p.terms}</p></>}
          </div>
          <div className="border-l border-[#e4dcdc]">
            <div className="flex justify-between border-b border-[#e4dcdc] px-4 py-3"><span>Subtotal</span><span className="tabular-nums">{formatKobo(p.subtotal)}</span></div>
            {p.discount > 0 && <div className="flex justify-between border-b border-[#e4dcdc] px-4 py-3"><span>Discount</span><span className="tabular-nums">−{formatKobo(p.discount)}</span></div>}
            {p.delivery_fee > 0 && <div className="flex justify-between border-b border-[#e4dcdc] px-4 py-3"><span>Delivery</span><span className="tabular-nums">{formatKobo(p.delivery_fee)}</span></div>}
            <div className="flex justify-between px-4 py-3 text-[15px] font-extrabold text-white" style={{ background: DARK }}><span>Total amount</span><span className="tabular-nums">{formatKobo(p.total)}</span></div>
          </div>
        </div>

        {/* How to pay */}
        {accounts.length > 0 && (
          <section className="mt-6 rounded-lg border border-[#e4dcdc] p-5 print:break-inside-avoid">
            <p className="text-[17px] font-extrabold tracking-wide" style={{ color: DARK }}>PAYMENT INSTRUCTIONS</p>
            <p className="mb-3 text-xs text-[#7a6868]">Please pay into {accounts.length === 1 ? "this account" : "one of these accounts"}.</p>
            <div className={`grid gap-3 ${accounts.length === 1 ? "" : accounts.length === 2 ? "sm:grid-cols-2 print:grid-cols-2" : "sm:grid-cols-3 print:grid-cols-3"}`}>
              {accounts.map((a) => (
                <div key={a.id} className="rounded-md border-2 p-3" style={{ borderColor: DARK }}>
                  <p className="mb-2 font-extrabold uppercase" style={{ color: DARK }}>{a.bank_name ?? a.name}</p>
                  <dl className="grid grid-cols-[auto_auto_1fr] gap-x-1.5 gap-y-1">
                    <dt className="font-bold" style={{ color: DARK }}>Bank</dt><dd>:</dd><dd>{a.bank_name ?? "–"}</dd>
                    <dt className="font-bold" style={{ color: DARK }}>Account name</dt><dd>:</dd><dd>{a.account_name ?? store?.name}</dd>
                    <dt className="font-bold" style={{ color: DARK }}>Account no.</dt><dd>:</dd><dd className="font-mono font-semibold">{a.account_number}</dd>
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#7a6868]">ⓘ Please use <b>{p.number}</b> as your payment reference so we can match your payment quickly.</p>
          </section>
        )}
      </div>

      {/* Closing band */}
      <div className="mt-8 flex items-center justify-between gap-4 px-8 py-5 text-white print:fixed print:inset-x-0 print:bottom-0 print:mt-0 print:px-6 print:py-3" style={{ background: DARK, borderTop: `4px solid ${RED}` }}>
        <p>Thank you for your business and continued trust in {store?.name}.</p>
        <p className="font-mono text-xs whitespace-nowrap">{p.number}</p>
      </div>
    </article>
  );
}
