"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export type Option = { value: string | number; label: string };

/** Loads a list endpoint as select options. Has its own cache key: other pages cache a different shape under ["options", endpoint]. */
export function useOptions(endpoint: string, label = "name"): Option[] {
  const { data } = useQuery({
    queryKey: ["select-options", endpoint, label],
    queryFn: async () => {
      const res = await api<Record<string, unknown>[] | { data?: Record<string, unknown>[] }>(`${endpoint}?per_page=100`);
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
  });

  return (Array.isArray(data) ? data : []).map((r) => ({ value: r.id as number, label: String(r[label]) }));
}
