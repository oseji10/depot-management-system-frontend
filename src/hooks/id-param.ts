"use client";

import { useSearchParams } from "next/navigation";

/**
 * Detail pages are static files, so the record is chosen by the address, e.g. /sales/view?id=12.
 * Pages using this must be wrapped in <Suspense> (see withSuspense in components/suspense-page.tsx).
 */
export function useIdParam(): string {
  return useSearchParams().get("id") ?? "";
}
