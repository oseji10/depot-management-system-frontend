"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useOptions } from "../hooks/options";
import { useSession } from "../hooks/session";
import { ApiError, api } from "../lib/api";
import { nairaToKobo } from "../lib/format";
import { useOffline } from "./offline-provider";
import { Button, ErrorNote, Field, Modal, MoneyField, SelectField } from "./ui";

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Log money spent. A salesperson's expense is saved on the phone first (it works with no signal) and comes off the cash
 * they hand in; everyone else records it straight to the books.
 */
export function ExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved?: (note: string) => void }) {
  const s = useSession();
  const offline = useOffline();
  const queryClient = useQueryClient();
  const clientRef = useRef(uid());

  const apiCategories = useOptions("/expense-categories");
  const branches = useOptions("/branches");
  const categories = offline ? (offline.snapshot?.expense_categories ?? []).map((c) => ({ value: c.id, label: c.name })) : apiCategories;

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [paidTo, setPaidTo] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [branch, setBranch] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [problem, setProblem] = useState<string | null>(null);

  const needsBranch = !offline && s.level === "store";
  const kobo = nairaToKobo(amount);
  const categoryName = categories.find((c) => String(c.value) === category)?.label ?? "Expense";

  const save = useMutation({
    mutationFn: async () => {
      const common = { category_id: Number(category), amount: kobo, method: offline ? ("cash" as const) : method, paid_to: paidTo || null, description: description || null };

      if (offline) {
        await offline.enqueueExpense({ ...common, category: categoryName, paid_to: paidTo, description });
        return offline.online ? "Saved and being sent to the depot." : "Saved on this phone. It will be sent when you have a signal.";
      }

      await api("/expenses", { method: "POST", body: { ...common, expense_date: date, client_ref: clientRef.current, ...(needsBranch ? { branch_id: Number(branch) } : {}) } });
      return "Expense recorded.";
    },
    onSuccess: (note) => {
      for (const key of ["expenses", "trip", "field", "dashboard", "reports"]) queryClient.invalidateQueries({ queryKey: [key] });
      onSaved?.(note);
      onClose();
    },
    onError: (e: Error) => {
      if (e instanceof ApiError) setErrors(e.errors ?? {});
      setProblem(e instanceof ApiError && e.errors ? null : e.message);
    },
  });

  return (
    <Modal title="Log an expense" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setProblem(null); save.mutate(); }} className="space-y-4">
        {offline && !offline.snapshot && <ErrorNote>Connect once to download the expense categories, then you can log expenses with no signal.</ErrorNote>}
        <SelectField label="What was it for?" value={category} onChange={setCategory} error={errors.category_id?.[0]} required options={[{ value: "", label: "Choose…" }, ...categories]} />
        <MoneyField label="Amount" value={amount} onChange={setAmount} error={errors.amount?.[0]} required autoFocus />
        {!offline && (
          <SelectField label="Paid from" value={method} onChange={(v) => setMethod(v as "cash" | "bank")} options={[{ value: "cash", label: "Cash on hand" }, { value: "bank", label: "Bank" }]} error={errors.method?.[0]} />
        )}
        <Field label="Paid to (optional)" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder={offline ? "Filling station, park attendant…" : "Who received the money"} error={errors.paid_to?.[0]} maxLength={120} />
        <Field label="Note (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description?.[0]} maxLength={255} />
        {!offline && <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.expense_date?.[0]} max={new Date().toLocaleDateString("en-CA")} />}
        {needsBranch && <SelectField label="Branch" value={branch} onChange={setBranch} required error={errors.branch_id?.[0]} options={[{ value: "", label: "Choose…" }, ...branches]} />}
        {offline && <p className="rounded-xl bg-paper px-3.5 py-2.5 text-xs text-ink-soft">Paid from your imprest (the running money you were given for this trip). It does not come off the sales cash you hand in.</p>}
        {(problem || errors.trip) && <ErrorNote>{problem ?? errors.trip[0]}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending} disabled={!category || kobo <= 0 || (needsBranch && !branch) || (!!offline && !offline.snapshot)}>Save expense</Button>
        </div>
      </form>
    </Modal>
  );
}
