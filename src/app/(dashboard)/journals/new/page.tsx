"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorNote, Field, ICON, PageHeader, SectionTitle, SelectField, Svg, inputClass } from "../../../../components/ui";
import { useOptions } from "../../../../hooks/options";
import { useSession } from "../../../../hooks/session";
import { ApiError, api } from "../../../../lib/api";
import { formatAmount } from "../../../../lib/format";
import type { Account, JournalEntry, Paginated } from "../../../../lib/types";

type Row = { account_id: string; debit: string; credit: string; memo: string };

const blank = (): Row => ({ account_id: "", debit: "", credit: "", memo: "" });
const money = (v: string) => v.replace(/[^\d.]/g, "");
const toKobo = (v: string) => Math.round((Number(v) || 0) * 100);

export default function NewJournalPage() {
  const s = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const branches = useOptions("/branches");

  const accounts = useQuery({
    queryKey: ["options", "/accounts", "coded"],
    queryFn: async () => (await api<Paginated<Account>>("/accounts?per_page=200")).data.filter((a) => a.is_active),
  });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<Row[]>([blank(), blank()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const accountOptions = [{ value: "", label: "Select an account" }, ...(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))];

  const debit = rows.reduce((t, r) => t + toKobo(r.debit), 0);
  const credit = rows.reduce((t, r) => t + toKobo(r.credit), 0);
  const filled = rows.filter((r) => toKobo(r.debit) > 0 || toKobo(r.credit) > 0);
  const balanced = debit === credit && debit > 0 && filled.length >= 2 && filled.every((r) => r.account_id);
  const patch = (i: number, p: Partial<Row>) => setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const save = useMutation({
    mutationFn: (post: boolean) =>
      api<JournalEntry>("/journals", {
        method: "POST",
        body: {
          entry_date: date, memo, post, branch_id: branchId ? Number(branchId) : null,
          lines: filled.map((r) => ({
            account_id: Number(r.account_id),
            debit: toKobo(r.debit) / 100, credit: toKobo(r.credit) / 100, memo: r.memo || null,
          })),
        },
      }),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["list", "/journals"] });
      router.replace(`/journals/view?id=${entry.id}`);
    },
    onError: (e: Error) => { setFormError(e.message); setErrors(e instanceof ApiError ? (e.errors ?? {}) : {}); },
  });

  const submit = (post: boolean) => { setErrors({}); setFormError(null); save.mutate(post); };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New journal" description="Record a transaction by hand. Total debits must equal total credits." />

      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-5">
        <Card>
          <SectionTitle n="1" title="Details" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.entry_date?.[0]} required />
            <div className="sm:col-span-2">
              <Field label="Description" value={memo} onChange={(e) => setMemo(e.target.value)} error={errors.memo?.[0]} placeholder="What is this entry for?" required />
            </div>
            <SelectField label="Branch (optional)" value={branchId} onChange={setBranchId}
              options={[{ value: "", label: "Whole company" }, ...branches]} hint="Tags every line to one branch." />
          </div>
        </Card>

        <Card>
          <SectionTitle n="2" title="Lines" hint="Use the debit column for money coming in or assets and expenses going up; credit for the opposite." />
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-3 rounded-xl bg-paper p-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
                <SelectField label="Account" value={r.account_id} onChange={(v) => patch(i, { account_id: v })} options={accountOptions}
                  error={errors[`lines.${i}.account_id`]?.[0]} />
                <label className="text-sm font-medium">
                  Debit (₦)
                  <input inputMode="decimal" value={r.debit} onChange={(e) => patch(i, { debit: money(e.target.value), credit: e.target.value ? "" : r.credit })}
                    className={`${inputClass} mt-1.5 text-right font-normal`} />
                </label>
                <label className="text-sm font-medium">
                  Credit (₦)
                  <input inputMode="decimal" value={r.credit} onChange={(e) => patch(i, { credit: money(e.target.value), debit: e.target.value ? "" : r.debit })}
                    className={`${inputClass} mt-1.5 text-right font-normal`} />
                </label>
                {rows.length > 2 && (
                  <button type="button" onClick={() => setRows((cur) => cur.filter((_, idx) => idx !== i))}
                    className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#c23a3a] transition hover:bg-red-50">Remove</button>
                )}
              </div>
            ))}
          </div>
          {errors.lines?.[0] && <p role="alert" className="mt-2 text-xs text-[#c23a3a]">{errors.lines[0]}</p>}
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setRows((cur) => [...cur, blank()])}>
            <Svg d={ICON.plus} /> Add a line
          </Button>

          <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-line bg-[#fff5f5] p-4 text-sm">
            <div><dt className="text-ink-soft">Total debit</dt><dd className="mt-0.5 font-semibold">{formatAmount(debit)}</dd></div>
            <div><dt className="text-ink-soft">Total credit</dt><dd className="mt-0.5 font-semibold">{formatAmount(credit)}</dd></div>
            <div>
              <dt className="text-ink-soft">Difference</dt>
              <dd className={`mt-0.5 font-semibold ${debit === credit ? "text-[#f40009]" : "text-[#c23a3a]"}`}>{formatAmount(Math.abs(debit - credit))}</dd>
            </div>
          </dl>
        </Card>

        {formError && !Object.keys(errors).length && <ErrorNote>{formError}</ErrorNote>}

        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/journals"><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="submit" variant="secondary" busy={save.isPending} disabled={!balanced || !memo.trim()}>Save as draft</Button>
          {s.can("journals.post") && (
            <Button type="button" busy={save.isPending} disabled={!balanced || !memo.trim()} onClick={() => submit(true)}>Post now</Button>
          )}
        </div>
      </form>
    </div>
  );
}
