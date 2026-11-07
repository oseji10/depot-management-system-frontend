"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSession } from "../hooks/session";
import type { TerminalChoice, TransferAccount } from "../lib/types";
import { terminalOf } from "./terminal-select";

export type TransferValue = { to?: "pos" | "account"; account?: number };

/** Has the person said where a bank transfer went? ("POS account" needs a machine to exist and be chosen.) */
export function transferReady(v: TransferValue, terminals: TerminalChoice[], terminal?: number) {
  return v.to === "pos" ? !!terminalOf(terminal, terminals) : v.to === "account" ? !!v.account : false;
}

/** What the server wants for a transfer line. */
export function transferPayload(v: TransferValue, terminals: TerminalChoice[], terminal?: number) {
  if (v.to === "pos") return { transfer_to: "pos" as const, ...(terminalOf(terminal, terminals) ? { pos_terminal_id: terminalOf(terminal, terminals) } : {}) };
  return { transfer_to: "account" as const, account_id: v.account };
}

/** "GTBank · ••••6789", or just the bank's name when no number was saved. */
export function accountLine(a: TransferAccount) {
  const tail = a.account_number ? `••••${a.account_number.slice(-4)}` : "";
  return [a.bank_name, tail].filter(Boolean).join(" · ") || a.code;
}

/**
 * Where did the transfer land? Every place a customer can pay is listed to tap: each POS machine (its money settles into that
 * machine's account) and each separate bank account the business has added. A single choice is picked for the cashier.
 */
export function TransferTarget({ accounts, terminals, value, terminal, onChange, onTerminal, indent = true }: {
  accounts: TransferAccount[]; terminals: TerminalChoice[]; value: TransferValue; terminal?: number;
  onChange: (v: TransferValue) => void; onTerminal: (id: number) => void; indent?: boolean;
}) {
  const s = useSession();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  // A machine's own settlement account is shown under the machine, so it is not listed twice.
  const separate = accounts.filter((a) => a.is_main || !(a.terminal_ids?.length));
  const picked = terminalOf(terminal, terminals);
  const options = terminals.length + separate.length;

  const chosenPos = value.to === "pos" ? picked : undefined;
  const missing = !transferReady(value, terminals, terminal);

  // What to read out to the customer: the account that is ticked.
  const details: TransferAccount | undefined = chosenPos
    ? (() => { const t = terminals.find((x) => x.id === chosenPos); return (t?.account_id ? byId.get(t.account_id) : undefined) ?? accounts.find((a) => a.is_main); })()
    : value.to === "account" && value.account ? byId.get(value.account) : undefined;

  function pickPos(id: number) { onTerminal(id); onChange({ to: "pos" }); }
  function pickAccount(id: number) { onChange({ to: "account", account: id }); }

  // With only one place the money can go, there is nothing to ask.
  useEffect(() => {
    if (!missing || options !== 1) return;
    if (terminals.length === 1) { onTerminal(terminals[0].id); onChange({ to: "pos" }); } else if (separate[0]) onChange({ to: "account", account: separate[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, options]);

  const card = (on: boolean) => `flex w-full min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${on ? "border-[#f40009] bg-[#ffe9ea]" : missing ? "border-amber-300 bg-white hover:border-[#ff3b3f]" : "border-line bg-white hover:border-[#ff3b3f]"}`;
  const dot = (on: boolean) => <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-[#f40009] bg-[#f40009]" : "border-line"}`}>{on && <span className="size-1.5 rounded-full bg-white" />}</span>;

  return (
    <div className={`mt-2 space-y-1.5 ${indent ? "sm:pl-[6.5rem]" : ""}`} role="radiogroup" aria-label="Where the transfer was paid">
      <p className={`text-xs font-medium ${missing ? "text-amber-700" : "text-ink-soft"}`}>Which account did the customer pay into?</p>

      {terminals.length > 0 && <p className="pt-0.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">Transfer to POS <span className="font-normal normal-case">(to the machine&apos;s account, not a card payment)</span></p>}
      {terminals.map((t) => {
        const acct = t.account_id ? byId.get(t.account_id) : accounts.find((a) => a.is_main);
        const on = chosenPos === t.id;
        return (
          <button key={`t${t.id}`} type="button" role="radio" aria-checked={on} onClick={() => pickPos(t.id)} className={card(on)}>
            {dot(on)}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">Transfer to POS · {t.name}{t.provider ? ` (${t.provider})` : ""}</span>
              <span className="block truncate text-xs text-ink-soft">{acct ? `${acct.name} · ${accountLine(acct)}` : "Main bank account"}</span>
            </span>
          </button>
        );
      })}

      {details && (
        <div className="rounded-xl border border-dashed border-[#ff3b3f]/50 bg-[#fff5f5] px-3 py-2.5 text-sm" aria-live="polite">
          <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">Pay into</p>
          <p className="mt-0.5 font-semibold">{details.account_name || details.name}</p>
          <p className="text-xs text-ink-soft">{details.bank_name ?? details.name}</p>
          {details.account_number && <p className="mt-0.5 font-mono text-lg font-bold tracking-wider select-all">{details.account_number}</p>}
        </div>
      )}

      {separate.length > 0 && <p className="pt-0.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">{terminals.length ? "Other bank accounts" : "Bank accounts"}</p>}
      {separate.map((a) => {
        const on = value.to === "account" && value.account === a.id;
        return (
          <button key={`a${a.id}`} type="button" role="radio" aria-checked={on} onClick={() => pickAccount(a.id)} className={card(on)}>
            {dot(on)}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{a.name}</span>
              <span className="block truncate text-xs text-ink-soft">{accountLine(a)}{a.account_name ? ` · ${a.account_name}` : ""}</span>
            </span>
          </button>
        );
      })}

      {s.can("accounts.manage") && (
        <Link href="/bank-accounts/" className="inline-block pt-0.5 text-xs font-semibold text-[#f40009] hover:underline">+ Add a bank account</Link>
      )}
    </div>
  );
}
