"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ProformaForm } from "../../../../components/proforma-form";
import { withSuspense } from "../../../../components/suspense-page";
import { PageHeader } from "../../../../components/ui";
import { useIdParam } from "../../../../hooks/id-param";
import { api } from "../../../../lib/api";
import type { Proforma } from "../../../../lib/types";

function EditProformaPage() {
  const id = useIdParam();
  const doc = useQuery({ queryKey: ["proforma", id], enabled: !!id, queryFn: () => api<Proforma>(`/proformas/${id}`) });

  if (!doc.data) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  return (
    <>
      <Link href={`/proformas/view?id=${id}`} className="mb-2 inline-block text-sm text-ink-soft hover:underline">← {doc.data.number}</Link>
      <PageHeader title={`Edit ${doc.data.number}`} />
      <ProformaForm existing={doc.data} />
    </>
  );
}

export default withSuspense(EditProformaPage);
