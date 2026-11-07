import { formatAmount, formatDateTime, formatKobo } from "../lib/format";
import { CHANNEL_LABEL, METHOD_PAY_LABEL } from "../lib/status";
import type { Sale } from "../lib/types";
import { BusinessHeader } from "./business-header";

// useSession is only used for the business logo and contact line, so a receipt always matches the signed-in business.

/** A till receipt. Narrow so it prints on a 80mm roll or A4 alike. `change` is only known right after the sale. */
export function Receipt({ sale, storeName, change = 0, onLogoSettled }: { sale: Sale; storeName: string; change?: number; onLogoSettled?: () => void }) {
  const payments = (sale.payments ?? []).filter((p) => !p.voided_at);

  return (
    <article className="receipt-80 mx-auto w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-[13px] shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* 80mm thermal roll (e.g. XPrinter XP-80T): paper is 80mm wide with a 72mm printable strip, any length. Only applies while printing. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { width: 80mm !important; margin: 0 !important; background: #fff !important; }
          .receipt-80 { width: 72mm !important; max-width: 72mm !important; margin: 0 4mm !important; padding: 2mm 0 10mm !important; font-size: 12px !important; line-height: 1.25 !important; color: #000 !important; break-inside: avoid; }
          .receipt-80 * { color: #000 !important; border-color: #000 !important; }
          .receipt-80 img { filter: grayscale(1) contrast(1.6); image-rendering: crisp-edges; }
          .receipt-80 .text-xs, .receipt-80 .text-\[11px\] { font-size: 11px !important; }
        }
      `}</style>
      <header className="text-center">
        <BusinessHeader onLogoSettled={onLogoSettled} branch={sale.branch?.name} />
        <p className="mt-3 font-mono text-sm font-semibold">{sale.number}</p>
        <p className="text-xs text-ink-soft">{formatDateTime(sale.sold_at)}</p>
        {sale.status === "void" && <p className="mt-2 inline-block rounded-md border-2 border-[#c23a3a] px-2 py-0.5 text-sm font-bold tracking-widest text-[#c23a3a]">VOID</p>}
      </header>

      <dl className="mt-4 space-y-0.5 border-t border-dashed border-line pt-3 text-xs text-ink-soft">
        <div className="flex justify-between"><dt>Customer</dt><dd className="font-medium text-ink">{sale.customer?.name ?? "Walk-in"}</dd></div>
        <div className="flex justify-between"><dt>Served by</dt><dd className="font-medium text-ink">{sale.creator?.name ?? "–"}</dd></div>
        <div className="flex justify-between"><dt>Type</dt><dd className="font-medium text-ink">{CHANNEL_LABEL[sale.channel]}</dd></div>
      </dl>

      <table className="mt-4 w-full border-t border-dashed border-line">
        <thead className="sr-only"><tr><th>Item</th><th>Amount</th></tr></thead>
        <tbody>
          {sale.lines?.map((l) => (
            <tr key={l.id} className="align-top">
              <td className="py-2 pr-2">
                <span className="block font-medium">{l.product?.name}</span>
                {l.mix_label && <span className="block text-[11px] font-semibold text-[#f40009]">Mixed crate · {l.mix_label}</span>}
                <span className="text-xs text-ink-soft">
                  {l.quantity} {l.unit?.name} × {formatAmount(l.unit_price)}
                  {l.unit_price < l.list_price && <> (was {formatAmount(l.list_price)})</>}
                </span>
              </td>
              <td className="py-2 text-right font-medium">{formatAmount(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="space-y-1 border-t border-dashed border-line pt-3">
        {sale.discount_total > 0 && (
          <div className="flex justify-between text-ink-soft"><dt>Discount</dt><dd>−{formatAmount(sale.discount_total)}</dd></div>
        )}
        {(sale.deposit_total ?? 0) > 0 && <div className="flex justify-between"><dt>Goods</dt><dd>{formatKobo(sale.total)}</dd></div>}
        {(sale.deposit_total ?? 0) > 0 && <div className="flex justify-between"><dt>Container deposit</dt><dd>{formatKobo(sale.deposit_total ?? 0)}</dd></div>}
        <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatKobo(sale.total + (sale.deposit_total ?? 0))}</dd></div>
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between text-ink-soft"><dt>{METHOD_PAY_LABEL[p.method]}</dt><dd>{formatAmount(p.amount)}</dd></div>
        ))}
        {change > 0 && <div className="flex justify-between font-medium"><dt>Change given</dt><dd>{formatAmount(change)}</dd></div>}
        {sale.balance_due > 0 && sale.status === "completed" && (
          <div className="flex justify-between font-bold text-[#c23a3a]"><dt>Balance owed</dt><dd>{formatKobo(sale.balance_due)}</dd></div>
        )}
      </dl>

      <p className="mt-5 text-center text-xs text-ink-soft">Thank you for your patronage.</p>
    </article>
  );
}
