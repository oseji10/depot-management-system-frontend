"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessHeader } from "./business-header";
import { Button, ICON, Svg } from "./ui";

/**
 * An A4 document (statement, payslip, credit note) with the business name, logo and contact line on top.
 * The toolbar and page chrome disappear when printing.
 */
export function PrintSheet({ back, title, subtitle, children, actions }: { back: { href: string; label: string }; title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode }) {

  return (
    <div>
      <style>{`@media print { @page { size: A4; margin: 14mm; } html, body { background: #fff !important; } .sheet * { color: #000 !important; border-color: #999 !important; } }`}</style>
      <div className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={back.href} className="text-sm font-semibold text-[#f40009] hover:underline">← {back.label}</Link>
        <div className="flex gap-2">{actions}<Button onClick={() => window.print()}><Svg d={ICON.print} /> Print</Button></div>
      </div>
      <article className="sheet mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 text-sm shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0 flex-1 text-left [&>div]:text-left [&_img]:mx-0">
            <BusinessHeader />
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide">{title}</p>
            {subtitle && <div className="text-xs text-ink-soft">{subtitle}</div>}
          </div>
        </header>
        <div className="pt-4">{children}</div>
      </article>
    </div>
  );
}
