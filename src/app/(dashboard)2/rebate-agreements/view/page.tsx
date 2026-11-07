"use client";

import { useQuery } from "@tanstack/react-query";
import { AgreementEditor } from "../../../../components/agreement-editor";
import { PageHeader } from "../../../../components/ui";
import { useSession } from "../../../../hooks/session";
import { api } from "../../../../lib/api";
import type { RebateAgreement } from "../../../../lib/types";
import { useIdParam } from "../../../../hooks/id-param";
import { withSuspense } from "../../../../components/suspense-page";

function EditAgreementPage() {
  const id = useIdParam();
  const s = useSession();
  const doc = useQuery({ queryKey: ["agreement", id], queryFn: () => api<RebateAgreement>(`/rebate-agreements/${id}`) });

  if (!doc.data) return <p className="text-sm text-ink-soft">{doc.error ? (doc.error as Error).message : "Loading…"}</p>;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={doc.data.name}
        description={s.can("rebates.configure")
          ? "Changing rates here affects months calculated from now on. Calculations you have already made keep the rates they used."
          : "You can view this agreement but not change it."}
      />
      {/* key forces a fresh form if the agreement is reloaded */}
      <fieldset disabled={!s.can("rebates.configure")} className="min-w-0 border-0 p-0">
        <AgreementEditor key={doc.dataUpdatedAt} agreement={doc.data} />
      </fieldset>
    </div>
  );
}

export default withSuspense(EditAgreementPage);
