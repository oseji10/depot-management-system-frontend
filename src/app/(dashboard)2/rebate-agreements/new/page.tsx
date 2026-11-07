"use client";

import { AgreementEditor } from "../../../../components/agreement-editor";
import { PageHeader } from "../../../../components/ui";

export default function NewAgreementPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New rebate agreement" description="Set the clusters first, then the tiers for each product group." />
      <AgreementEditor />
    </div>
  );
}
