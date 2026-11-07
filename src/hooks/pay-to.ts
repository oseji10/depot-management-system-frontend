import { useQuery } from "@tanstack/react-query";
import { useSession } from "./session";
import { api } from "../lib/api";
import { accountLine } from "../components/transfer-target";
import type { TerminalChoice, TransferAccount } from "../lib/types";

/** The business's bank accounts as lines to put on an invoice: "GTBank · ••••6789 (Alpha Depot Ltd)". Only accounts with a number saved. */
export function usePayTo(): string[] {
  const s = useSession();
  const q = useQuery({
    queryKey: ["terminals", "available", undefined], enabled: s.can("sales.create"), staleTime: 5 * 60_000,
    queryFn: () => api<{ data: TerminalChoice[]; accounts?: TransferAccount[] }>("/pos-terminals/available"),
  });

  return (q.data?.accounts ?? []).filter((a) => a.account_number).slice(0, 3)
    .map((a) => `${a.bank_name ?? a.name} ${a.account_number}${a.account_name ? ` (${a.account_name})` : ""}`);
}

export { accountLine };
