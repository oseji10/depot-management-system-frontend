"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, ErrorNote, Field, PageHeader, SelectField } from "../../../components/ui";
import { api } from "../../../lib/api";
import { API_URL, authHeaders } from "../../../lib/auth";
import { formatDate } from "../../../lib/format";

type Settings = { enabled: boolean; time: string; day: "today" | "yesterday"; owners: boolean; user_ids: number[]; role_ids: number[]; emails: string[] };
type Data = {
  settings: Settings; last_sent: string | null; recipients: string[]; pdf_ready: boolean; timezone: string;
  roles: { id: number; name: string }[]; users: { id: number; name: string; email: string }[];
};
type DryRun = { due: boolean; reason: string; now: string; timezone: string; report_date: string; recipients: string[]; pdf: { bytes: number; seconds: number } | null; summary: Record<string, string> };
const today = () => new Date().toISOString().slice(0, 10);
const box = "rounded-2xl border border-line bg-surface p-5 shadow-sm";

/** Who gets the automatic daily sales report, and when. */
export default function DailyReportPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["daily-report"], queryFn: () => api<Data>("/reports/daily/settings") });
  const [f, setF] = useState<Settings | null>(null);
  const [emails, setEmails] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (q.data && !f) { setF(q.data.settings); setEmails(q.data.settings.emails.join(", ")); }
  }, [q.data, f]);

  const body = () => ({ ...f!, emails: emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) });
  const save = useMutation({
    mutationFn: () => api<Data>("/reports/daily/settings", { method: "PUT", body: body() }),
    onSuccess: (d) => { qc.setQueryData(["daily-report"], d); setNote("Saved."); },
  });
  const dry = useMutation({ mutationFn: () => api<DryRun>(`/reports/daily/dry-run?date=${date}`) });
  const send = useMutation({
    mutationFn: (onlyMe: boolean) => api<{ sent_to: string[] }>("/reports/daily/send", { method: "POST", body: { date, only_me: onlyMe } }),
    onSuccess: (r) => setNote(`Report for ${formatDate(date)} sent to ${r.sent_to.join(", ")}.`),
  });

  async function openPdf() {
    setPdfBusy(true);
    try {
      const res = await fetch(`${API_URL}/reports/daily/pdf?date=${date}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Could not build the report.");
      window.open(URL.createObjectURL(await res.blob()), "_blank");
    } catch (e) { setNote((e as Error).message); } finally { setPdfBusy(false); }
  }

  if (q.isLoading || !f) return <PageHeader title="Daily sales report" description="Loading…" />;
  if (q.error) return <ErrorNote>{(q.error as Error).message}</ErrorNote>;
  const d = q.data!;
  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Daily sales report" description="A summary email with the full report attached as a PDF: sales, payments, products, staff, customers, expenses, debts and low stock, compared with the day before." />

      {!d.pdf_ready && (
        <div className="mb-4 rounded-2xl border border-[#f4c34d] bg-[#fff8e5] p-4 text-sm">
          The PDF library is not installed on the server yet, so emails will carry the summary only. On the server, run <code className="rounded bg-white px-1.5">composer require dompdf/dompdf</code> in the backend folder.
        </div>
      )}

      <div className="space-y-4">
        <section className={box}>
          <label className="flex items-center gap-3 text-base font-semibold">
            <input type="checkbox" className="size-5 accent-[#f40009]" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
            Send the daily sales report automatically
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Send at" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} hint={`Business time (${d.timezone}).`} />
            <SelectField label="Report covers" value={f.day} onChange={(v) => setF({ ...f, day: v as Settings["day"] })}
              options={[{ value: "today", label: "Today so far (best for an evening send)" }, { value: "yesterday", label: "The whole of yesterday (best for a morning send)" }]} />
          </div>
          <p className="mt-3 text-xs text-ink-soft">{d.last_sent ? `Last sent automatically for ${formatDate(d.last_sent)}.` : "Not sent automatically yet."} It goes out once a day, at the first check after the time you set.</p>
        </section>

        <section className={box}>
          <h2 className="mb-3 text-base font-semibold">Who receives it</h2>
          <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#f40009]" checked={f.owners} onChange={(e) => setF({ ...f, owners: e.target.checked })} /> The business owner(s)</label>

          <p className="mb-1.5 text-sm font-medium">Everyone with these roles</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {d.roles.map((r) => (
              <label key={r.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${f.role_ids.includes(r.id) ? "border-[#f40009] bg-[#fff1f1]" : "border-line bg-white"}`}>
                <input type="checkbox" className="size-4 accent-[#f40009]" checked={f.role_ids.includes(r.id)} onChange={() => setF({ ...f, role_ids: toggle(f.role_ids, r.id) })} /> {r.name}
              </label>
            ))}
          </div>

          <p className="mb-1.5 text-sm font-medium">These people</p>
          <div className="mb-4 grid max-h-64 gap-1.5 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
            {d.users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[#f40009]" checked={f.user_ids.includes(u.id)} onChange={() => setF({ ...f, user_ids: toggle(f.user_ids, u.id) })} />
                <span>{u.name} <span className="text-ink-soft">· {u.email}</span></span>
              </label>
            ))}
          </div>

          <label className="block text-sm font-medium">Other email addresses
            <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} placeholder="e.g. accountant@example.com, partner@example.com"
              className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm font-normal" />
          </label>
          <p className="mt-1 text-xs text-ink-soft">Separate addresses with commas. Useful for an accountant or partner without a login.</p>

          <div className="mt-4 rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="font-medium">Currently goes to ({d.recipients.length}):</span> {d.recipients.length ? d.recipients.join(", ") : "nobody yet"}
            <span className="block text-xs text-ink-soft">Updates after you save.</span>
          </div>
        </section>

        {(save.error || send.error) && <ErrorNote>{((save.error ?? send.error) as Error).message}</ErrorNote>}
        {note && <p className="rounded-xl bg-[#effaf3] px-3 py-2 text-sm text-[#127a3a]">{note}</p>}

        <div className="flex justify-end"><Button busy={save.isPending} onClick={() => { setNote(null); save.mutate(); }}>Save settings</Button></div>

        <section className={box}>
          <h2 className="mb-3 text-base font-semibold">See or send a report now</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Day" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            <Button variant="secondary" busy={dry.isPending} onClick={() => dry.mutate()}>Dry run</Button>
            <Button variant="secondary" busy={pdfBusy} onClick={openPdf}>Open the report</Button>
            <Button variant="secondary" busy={send.isPending && send.variables === true} onClick={() => { setNote(null); send.mutate(true); }}>Email it to me</Button>
            <Button busy={send.isPending && send.variables === false} onClick={() => { if (window.confirm("Email this report to everyone on the list now?")) { setNote(null); send.mutate(false); } }}>Email it to everyone</Button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Dry run builds everything and shows what would happen, without emailing anyone. Sending from here does not stop tonight&apos;s automatic email.</p>
          {dry.error && <div className="mt-3"><ErrorNote>{(dry.error as Error).message}</ErrorNote></div>}
          {dry.data && (
            <div className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm">
              <p className="font-semibold">Dry run for {formatDate(dry.data.report_date)} · nothing was sent</p>
              <p className={`mt-1 ${dry.data.due ? "text-[#127a3a]" : "text-ink-soft"}`}>Automatic sending: {dry.data.reason}</p>
              <p className="mt-1"><span className="font-medium">Would go to ({dry.data.recipients.length}):</span> {dry.data.recipients.length ? dry.data.recipients.join(", ") : "nobody yet. Add people above and save."}</p>
              <p className="mt-1">{dry.data.pdf ? `PDF built fine (${Math.round(dry.data.pdf.bytes / 1024)} KB in ${dry.data.pdf.seconds}s).` : "No PDF: the PDF library is not installed on the server, so the email would carry the summary only."}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {Object.entries(dry.data.summary).map(([k, v]) => <div key={k} className="flex justify-between border-b border-line py-1"><dt className="text-ink-soft">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
              </dl>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
