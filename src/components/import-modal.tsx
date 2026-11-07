"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { readSheet, type ParsedSheet, type SheetColumn } from "../lib/spreadsheet";
import { Button, ErrorNote, Modal } from "./ui";

type Report = { counts: Record<string, number>; problems: { row: number; message: string }[]; notes: string[] };

/**
 * Bulk upload from an Excel/CSV file. The file is read here in the browser, then sent a batch at a time; every importer
 * on the server skips rows it already has, so if anything stops half-way just run the same file again.
 */
export function ImportModal({
  title, intro, endpoint, columns, extra, options, batchSize = 100, labels, onClose,
}: {
  title: string;
  intro: ReactNode;
  endpoint: string;
  columns: SheetColumn[];
  /** Fixed fields sent with every batch (e.g. the branch). Null while the options are still incomplete. */
  extra: Record<string, unknown> | null;
  options?: ReactNode;
  batchSize?: number;
  /** count key -> sentence fragment, in the order they should be shown */
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [report, setReport] = useState<Report>({ counts: {}, problems: [], notes: [] });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setSheet(null); setFinished(false); setDone(0); setReport({ counts: {}, problems: [], notes: [] });
    setFileName(file.name);
    try {
      setSheet(await readSheet(file, columns));
    } catch (e) {
      setError((e as Error).message || "Could not read that file.");
    }
  };

  const start = async () => {
    if (!sheet || !extra) return;
    setRunning(true); setError(""); setFinished(false); setDone(0);
    const total: Report = { counts: {}, problems: [], notes: [] };
    // One id for the whole file, so the server can show it as a single upload in the history.
    const batch = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`, file_name: fileName, total: sheet.rows.length };

    try {
      for (let at = 0; at < sheet.rows.length; at += batchSize) {
        const r = await api<Report>(endpoint, { method: "POST", body: { ...extra, batch, rows: sheet.rows.slice(at, at + batchSize) } });
        for (const [k, v] of Object.entries(r.counts)) total.counts[k] = (total.counts[k] ?? 0) + v;
        total.problems.push(...r.problems);
        for (const n of r.notes) if (!total.notes.includes(n) && total.notes.length < 40) total.notes.push(n);
        setDone(Math.min(at + batchSize, sheet.rows.length));
        setReport({ counts: { ...total.counts }, problems: total.problems.slice(0, 100), notes: [...total.notes] });
      }
      setFinished(true);
    } catch (e) {
      setError(`${(e as Error).message} — what was already imported is kept. Run the same file again to carry on.`);
    } finally {
      setRunning(false);
      qc.invalidateQueries();
    }
  };

  const pct = sheet && sheet.found ? Math.round((done / sheet.found) * 100) : 0;
  const shown = Object.keys(labels).filter((k) => report.counts[k]);

  return (
    <Modal title={title} onClose={running ? () => undefined : onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="text-ink-soft">{intro}</div>

        {!finished && (
          <>
            {options}
            <div>
              <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Choose the file" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
              <Button type="button" variant="secondary" disabled={running} onClick={() => input.current?.click()}>{sheet ? "Choose a different file" : "Choose Excel file"}</Button>
              {fileName && <span className="ml-3 text-ink-soft">{fileName}</span>}
            </div>
          </>
        )}

        {sheet && sheet.missing.length > 0 && (
          <ErrorNote>This file does not look right. It has no column called {sheet.missing.map((m) => `"${m}"`).join(", ")}. Upload the export as it came from your old system.</ErrorNote>
        )}
        {sheet && sheet.missing.length === 0 && !running && !finished && (
          <p className="rounded-xl bg-[#ffe9ea] px-4 py-3 text-[#a50006]">Found <strong>{sheet.found}</strong> row{sheet.found === 1 ? "" : "s"}. Nothing is saved until you press Import.</p>
        )}

        {(running || done > 0) && sheet && (
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-[#ff3b3f] transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1.5 text-xs text-ink-soft">{done} of {sheet.found} rows{running ? " — keep this page open" : ""}</p>
          </div>
        )}

        {shown.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-line bg-surface px-4 py-3">
            {shown.map((k) => <li key={k}><strong>{report.counts[k].toLocaleString()}</strong> {labels[k]}</li>)}
          </ul>
        )}
        {report.notes.length > 0 && (
          <ul className="list-disc space-y-1 rounded-xl bg-amber-50 py-3 pr-4 pl-8 text-amber-800">{report.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        )}
        {report.problems.length > 0 && (
          <details className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[#c23a3a]" open={finished}>
            <summary className="cursor-pointer font-semibold">{report.counts.problems ?? report.problems.length} row{(report.counts.problems ?? 1) === 1 ? "" : "s"} could not be imported</summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto">{report.problems.map((p, i) => <li key={i}>Row {p.row}: {p.message}</li>)}</ul>
          </details>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2">
          {finished ? (
            <Button type="button" onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="secondary" disabled={running} onClick={onClose}>Cancel</Button>
              <Button type="button" busy={running} disabled={!sheet || sheet.missing.length > 0 || sheet.found === 0 || !extra} onClick={start}>Import</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
