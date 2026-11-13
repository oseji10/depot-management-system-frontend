"use client";

import { formatDateTime } from "../lib/format";
import type { TripReport } from "../lib/types";
import { formatQty } from "../lib/units";
import { BusinessHeader } from "./business-header";
import { Button, ICON, Svg } from "./ui";

type Load = TripReport["loads"][number];

/**
 * The paper that goes with the driver: what was loaded onto (or came off) the van, with signature lines for the person
 * who released the stock and the driver who received it. Opens over the page; only the note itself prints.
 */
export function DispatchNote({ report, load, onClose }: { report: TripReport; load: Load; onClose: () => void }) {
  const issue = load.kind === "issue";
  const rows = load.lines.map((x) => {
    const row = report.lines.find((l) => l.name === x.product);
    return { ...x, text: row ? formatQty(x.quantity, row.base_unit, row.pack) : x.quantity.toLocaleString("en-NG"), base: row?.base_unit ?? null };
  });
  const units = rows.filter((r) => r.status === "saleable").reduce((n, r) => n + r.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:static print:overflow-visible print:bg-transparent print:p-0">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body * { visibility: hidden !important; } .dispatch-note, .dispatch-note * { visibility: visible !important; } .dispatch-note { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; } .dispatch-note * { color: #000 !important; border-color: #888 !important; } }`}</style>
      <div className="mx-auto mb-3 flex max-w-2xl justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
      <article className="dispatch-note mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-sm shadow-sm">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0 flex-1 text-left [&>div]:text-left [&_img]:mx-0"><BusinessHeader /></div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide">{issue ? "Dispatch note" : "Stock returned"}</p>
            <p className="font-mono text-xs">{report.trip.number}</p>
            <p className="text-xs text-ink-soft">{formatDateTime(load.at)}</p>
          </div>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex justify-between"><dt className="text-ink-soft">Driver / salesperson</dt><dd className="font-semibold">{report.rep.name}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Van</dt><dd className="font-semibold">{report.van.name}</dd></div>
          {report.vehicle && <div className="flex justify-between"><dt className="text-ink-soft">Vehicle</dt><dd className="font-semibold">{report.vehicle.nickname || report.vehicle.reg_no}</dd></div>}
          {report.terminal && <div className="flex justify-between"><dt className="text-ink-soft">POS terminal</dt><dd className="font-semibold">{report.terminal.name}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-soft">{issue ? "Released from" : "Received into"}</dt><dd className="font-semibold">{load.warehouse ?? "–"}</dd></div>
          {load.by && <div className="flex justify-between"><dt className="text-ink-soft">Recorded by</dt><dd className="font-semibold">{load.by}</dd></div>}
        </dl>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2 text-right">Quantity</th><th className="py-2 text-right">Checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-2 pr-2 text-ink-soft">{i + 1}</td>
                <td className="py-2 pr-2 font-medium">{r.product}{r.status !== "saleable" ? <span className="font-normal text-ink-soft"> ({r.status})</span> : null}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.text}{r.base && r.text !== r.quantity.toLocaleString("en-NG") ? <span className="block text-xs text-ink-soft">{r.quantity.toLocaleString("en-NG")} {r.base}</span> : null}</td>
                <td className="py-2 text-right">☐</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={2} className="pt-2 text-right font-semibold">Total saleable</td><td className="pt-2 text-right font-bold tabular-nums">{units.toLocaleString("en-NG")}</td><td /></tr>
          </tfoot>
        </table>

        {load.note && <p className="mt-4 text-xs italic">Note: {load.note}</p>}

        <div className="mt-14 grid grid-cols-2 gap-10 text-xs">
          <div><div className="border-t border-black pt-1">{issue ? "Released by (name, signature)" : "Received by (name, signature)"}</div></div>
          <div><div className="border-t border-black pt-1">{issue ? "Received by driver (name, signature)" : "Returned by driver (name, signature)"}</div></div>
        </div>
      </article>
    </div>
  );
}
