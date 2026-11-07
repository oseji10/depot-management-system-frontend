"use client";

import Link from "next/link";
import { ProformaForm } from "../../../../components/proforma-form";
import { PageHeader } from "../../../../components/ui";

export default function NewProformaPage() {
  return (
    <>
      <Link href="/proformas" className="mb-2 inline-block text-sm text-ink-soft hover:underline">← Proforma invoices</Link>
      <PageHeader title="New proforma invoice" description="A quotation with today's prices. It holds no stock and records no money until you turn it into a sale." />
      <ProformaForm />
    </>
  );
}
