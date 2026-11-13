"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState, type ReactNode } from "react";
import { ApiError, api } from "../lib/api";
import type { Paginated } from "../lib/types";
import { Button, ErrorNote, Field, Modal, PageHeader, Pager, SearchBox, SelectField, TableCard, TableEmpty, TableError, TableLoading, Toolbar, theadClass, thClass, Svg, ICON } from "./ui";
import { DeleteButton } from "./delete-button";

type Option = { value: string | number; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "select" | "checkbox" | "date" | "number" | "multicheck";
  required?: boolean; // marks the field required when creating
  createOnly?: boolean;
  editOnly?: boolean;
  hint?: string;
  options?: Option[];
  /** Load select options from an API list endpoint. */
  optionsFrom?: { endpoint: string; label?: string; empty?: string };
};

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string };

type Props<T extends { id: number }> = {
  title: string;
  description: string;
  endpoint: string;
  noun: string;
  columns: Column<T>[];
  fields: FieldDef[];
  canCreate?: boolean;
  canEdit?: boolean;
  /** Show a Delete button when editing a record. The server refuses (with a reason) if the record has been used. */
  canDelete?: boolean;
  searchable?: boolean;
  initial?: Record<string, unknown>;
  toForm?: (row: T) => Record<string, unknown>;
  empty?: string;
};

export function CrudPage<T extends { id: number }>(p: Props<T>) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [editing, setEditing] = useState<T | "new" | null>(null);

  const listKey = ["list", p.endpoint, page, deferred];
  const { data, isLoading, error } = useQuery({
    queryKey: listKey,
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (deferred) q.set("search", deferred);
      return api<Paginated<T>>(`${p.endpoint}?${q}`);
    },
  });

  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: ["list", p.endpoint] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const columns = p.canEdit || p.canDelete
    ? [...p.columns, { header: "", cell: (row: T) => (
        <div className="flex items-start justify-end gap-2">
          {p.canEdit && (
            <button onClick={() => setEditing(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-[#f40009] transition hover:border-[#ff3b3f]/30 hover:bg-[#ffe9ea]">
              <Svg d={ICON.edit} /> Edit
            </button>
          )}
          {p.canDelete && <DeleteButton size="sm" path={`${p.endpoint}/${row.id}`} noun={p.noun} onDone={refreshList} />}
        </div>
      ), className: "text-right" }]
    : p.columns;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={p.title}
        description={p.description}
        action={p.canCreate && <Button onClick={() => setEditing("new")}>Add {p.noun}</Button>}
      />

      <Toolbar>
        {p.searchable !== false && (
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={`Search ${p.title.toLowerCase()}`} />
        )}
        {data && <span className="ml-auto pr-1 text-sm text-ink-soft">{data.total} {data.total === 1 ? p.noun : `${p.noun}s`}</span>}
      </Toolbar>

      <TableCard>
        <thead className={theadClass}>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" className={`${thClass} ${c.className ?? ""}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isLoading && <TableLoading cols={columns.length} />}
          {error && <TableError cols={columns.length} message={(error as Error).message} />}
          {data?.data.length === 0 && (
            <TableEmpty cols={columns.length} title={p.empty ?? `No ${p.title.toLowerCase()} yet`} hint={search ? "Try a different search." : p.canCreate ? `Add your first ${p.noun} to get started.` : undefined} />
          )}
          {data?.data.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-[#fff5f5]">
              {columns.map((c, i) => (
                <td key={i} className={`px-4 py-3.5 ${c.className ?? ""}`}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableCard>

      {data && <Pager page={page} last={data.last_page} total={data.total} current={data.current_page} setPage={setPage} />}

      {editing && (
        <RecordForm
          {...p}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["list", p.endpoint] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      )}
    </div>
  );
}

function RecordForm<T extends { id: number }>(
  p: Props<T> & { row: T | null; onClose: () => void; onSaved: () => void },
) {
  const isNew = p.row === null;
  const fields = p.fields.filter((f) => (isNew ? !f.editOnly : !f.createOnly));

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = {};
    for (const f of fields) base[f.name] = f.type === "checkbox" ? false : f.type === "multicheck" ? [] : "";
    return { ...base, ...(isNew ? p.initial : p.toForm ? p.toForm(p.row as T) : (p.row as object)) };
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        let v = values[f.name];
        if (f.type === "select" && typeof v === "string" && /^\d+$/.test(v)) v = Number(v);
        body[f.name] = v === "" ? null : v;
      }
      return isNew
        ? api(p.endpoint, { method: "POST", body })
        : api(`${p.endpoint}/${(p.row as T).id}`, { method: "PUT", body });
    },
    onSuccess: p.onSaved,
    onError: (e: Error) => {
      setFormError(e.message);
      setErrors(e instanceof ApiError ? (e.errors ?? {}) : {});
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`${p.endpoint}/${(p.row as T).id}`, { method: "DELETE" }),
    onSuccess: p.onSaved,
    onError: (e: Error) => { setFormError(e.message); setErrors({}); },
  });

  return (
    <Modal title={isNew ? `Add ${p.noun}` : `Edit ${p.noun}`} onClose={p.onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); setFormError(null); setErrors({}); save.mutate(); }}
        className="space-y-4"
      >
        {fields.map((f) => (
          <FormControl
            key={f.name}
            def={f}
            required={isNew && f.required}
            value={values[f.name]}
            error={errors[f.name]?.[0]}
            onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
          />
        ))}

        {formError && !Object.keys(errors).length && (
          <ErrorNote>{formError}</ErrorNote>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div>
            {!isNew && p.canDelete && (
              <Button type="button" variant="danger" busy={remove.isPending}
                onClick={() => { if (window.confirm(`Delete this ${p.noun}? It is hidden from the system, and refused if it has already been used.`)) { setFormError(null); remove.mutate(); } }}>
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={p.onClose}>Cancel</Button>
            <Button type="submit" busy={save.isPending}>{isNew ? `Add ${p.noun}` : "Save changes"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function FormControl({ def, value, error, required, onChange }: {
  def: FieldDef; value: unknown; error?: string; required?: boolean; onChange: (v: unknown) => void;
}) {
  if (def.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[#f40009]" />
        {def.label}
      </label>
    );
  }

  if (def.type === "multicheck") {
    return <RemoteChecks def={def} value={Array.isArray(value) ? (value as number[]) : []} error={error} onChange={onChange} />;
  }

  if (def.type === "select") {
    return <RemoteSelect def={def} value={String(value ?? "")} error={error} required={required} onChange={onChange} />;
  }

  return (
    <Field
      label={def.label}
      type={def.type ?? "text"}
      value={String(value ?? "")}
      required={required}
      hint={def.hint}
      error={error}
      autoComplete={def.type === "password" ? "new-password" : "off"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Tick several records (e.g. branches). The order they were ticked in is kept: the first is the main one. */
function RemoteChecks({ def, value, error, onChange }: { def: FieldDef; value: number[]; error?: string; onChange: (v: number[]) => void }) {
  const { data } = useQuery({
    queryKey: ["options", def.optionsFrom?.endpoint],
    enabled: !!def.optionsFrom,
    queryFn: async () => (await api<Paginated<Record<string, unknown>> | { data: Record<string, unknown>[] }>(`${def.optionsFrom!.endpoint}?per_page=100`)).data,
  });
  const opts: Option[] = def.options ?? (data ?? []).map((r) => ({ value: r.id as number, label: String(r[def.optionsFrom?.label ?? "name"]) }));

  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">{def.label}</legend>
      <div className="grid gap-1.5 rounded-xl border border-line p-3 sm:grid-cols-2">
        {opts.length === 0 && <p className="text-sm text-ink-soft">Nothing to choose yet.</p>}
        {opts.map((o) => {
          const id = Number(o.value);
          const at = value.indexOf(id);
          return (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#f40009]" checked={at >= 0} onChange={() => onChange(at >= 0 ? value.filter((x) => x !== id) : [...value, id])} />
              {o.label}{at === 0 && value.length > 1 && <span className="rounded bg-paper px-1.5 text-[11px] font-semibold text-ink-soft">Main</span>}
            </label>
          );
        })}
      </div>
      {error ? <p className="mt-1 text-xs text-[#c23a3a]">{error}</p> : def.hint && <p className="mt-1 text-xs text-ink-soft">{def.hint}</p>}
    </fieldset>
  );
}

function RemoteSelect({ def, value, error, required, onChange }: {
  def: FieldDef; value: string; error?: string; required?: boolean; onChange: (v: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["options", def.optionsFrom?.endpoint],
    enabled: !!def.optionsFrom,
    queryFn: async () => {
      const res = await api<Paginated<Record<string, unknown>> | { data: Record<string, unknown>[] }>(
        `${def.optionsFrom!.endpoint}?per_page=100`,
      );
      return res.data;
    },
  });

  const remote: Option[] = (data ?? []).map((r) => ({
    value: r.id as number,
    label: String(r[def.optionsFrom?.label ?? "name"]),
  }));

  const options: Option[] = [
    { value: "", label: def.optionsFrom?.empty ?? "Select…" },
    ...(def.options ?? []),
    ...remote,
  ];

  return <SelectField label={def.label} value={value} onChange={onChange} options={options} error={error} hint={def.hint} required={required} />;
}
