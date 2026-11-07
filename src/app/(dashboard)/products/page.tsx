"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { ImportProductsButton } from "../../../components/import-buttons";
import { ProductThumb, shrinkImage, useProductImage } from "../../../components/product-image";
import { Badge, Button, Field, Modal, PageHeader, SelectField, StatusBadge } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { useOptions } from "../../../hooks/options";
import { ApiError, api } from "../../../lib/api";
import type { Paginated, Product } from "../../../lib/types";

const PACKAGING = [
  { value: "rgb", label: "RGB (returnable glass)" },
  { value: "pet", label: "PET (plastic)" },
  { value: "can", label: "Can" },
  { value: "other", label: "Other" },
];

const packagingLabel = (p: string) => PACKAGING.find((o) => o.value === p)?.label.split(" ")[0] ?? p;

// Colour-coded avatar per packaging type
const PACKAGING_STYLE: Record<string, string> = {
  rgb: "bg-[#ffe9ea] text-[#f40009] ring-[#ff3b3f]/20",
  pet: "bg-sky-50 text-sky-700 ring-sky-200",
  can: "bg-amber-50 text-amber-700 ring-amber-200",
  other: "bg-slate-100 text-slate-600 ring-slate-200",
};

const ERR = "text-[#c23a3a]";

function Svg({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const I = {
  search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  chevron: "m6 9 6 6 6-6",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  left: "m15 6-6 6 6 6",
  right: "m9 6 6 6-6 6",
};

const filterClass =
  "min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm transition hover:border-[#ff3b3f]/40 focus:border-[#ff3b3f] focus:outline-none focus:ring-4 focus:ring-[#ff3b3f]/15";

export default function ProductsPage() {
  const s = useSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [categoryId, setCategoryId] = useState("");
  const [packaging, setPackaging] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const categories = useOptions("/product-categories");

  const { data, isLoading, error } = useQuery({
    queryKey: ["list", "/products", page, deferred, categoryId, packaging],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (deferred) q.set("search", deferred);
      if (categoryId) q.set("category_id", categoryId);
      if (packaging) q.set("packaging", packaging);
      return api<Paginated<Product>>(`/products?${q}`);
    },
  });

  const canManage = s.can("products.manage");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { setDeleteError(null); void queryClient.invalidateQueries({ queryKey: ["list", "/products"] }); },
    onError: (e: Error) => setDeleteError(e.message),
  });
  const hasFilters = Boolean(search || categoryId || packaging);

  const clearFilters = () => {
    setSearch("");
    setCategoryId("");
    setPackaging("");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Products"
        description="Everything you buy and sell. Each product has a base unit (a bottle or a can) and optional packs such as a crate or a case."
        action={canManage && <div className="flex gap-2"><ImportProductsButton /><Button onClick={() => setEditing("new")}>Add product</Button></div>}
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="relative min-w-52 max-w-md flex-1">
          <label htmlFor="product-search" className="sr-only">Search products</label>
          <Svg d={I.search} className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" />
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, SKU or brand"
            className={`${filterClass} w-full pl-10`}
          />
        </div>

        <div className="relative">
          <label className="sr-only" htmlFor="filter-category">Category</label>
          <select id="filter-category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={`${filterClass} appearance-none pr-9`}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <Svg d={I.chevron} className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" />
        </div>

        <div className="relative">
          <label className="sr-only" htmlFor="filter-packaging">Packaging</label>
          <select id="filter-packaging" value={packaging} onChange={(e) => { setPackaging(e.target.value); setPage(1); }} className={`${filterClass} appearance-none pr-9`}>
            <option value="">All packaging</option>
            {PACKAGING.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <Svg d={I.chevron} className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#f40009] transition hover:bg-[#ffe9ea]">
            <Svg d={I.x} /> Clear
          </button>
        )}

        {data && <span className="ml-auto pr-1 text-sm text-ink-soft">{data.total} product{data.total === 1 ? "" : "s"}</span>}
      </div>

      {/* Table */}
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold">Product</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Rebate category</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Sold as</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-11 animate-pulse rounded-xl bg-line" />
                      <div className="space-y-2">
                        <div className="h-3.5 w-40 animate-pulse rounded bg-line" />
                        <div className="h-3 w-28 animate-pulse rounded bg-line/70" />
                      </div>
                    </div>
                  </td>
                  {[0, 1, 2, 3].map((c) => (
                    <td key={c} className="px-4 py-4"><div className="h-3.5 w-24 animate-pulse rounded bg-line" /></td>
                  ))}
                  <td />
                </tr>
              ))}

            {error && (
              <tr><td colSpan={6} className={`px-4 py-10 text-center ${ERR}`}>{(error as Error).message}</td></tr>
            )}

            {data?.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ffe9ea] text-[#f40009]">
                    <Svg d={I.box} className="size-7" />
                  </span>
                  <p className="mt-4 font-semibold">No products found</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {hasFilters ? "Try a different search or clear your filters." : "Add your first product to get started."}
                  </p>
                </td>
              </tr>
            )}

            {data?.data.map((p) => (
              <tr key={p.id} className="group transition-colors hover:bg-[#fff5f5]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <ProductThumb url={p.image_url} name={p.name} fallbackClass={PACKAGING_STYLE[p.packaging] ?? PACKAGING_STYLE.other} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {p.name} {p.is_returnable && <Badge tone="warn">Returnable</Badge>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                        {[p.sku, p.brand, p.size_label].filter(Boolean).map((x, i) => (
                          <span key={i} className={i === 0 ? "font-mono" : ""}>{x}</span>
                        ))}
                        <span className="rounded-md bg-paper px-1.5 py-0.5 font-medium">{packagingLabel(p.packaging)}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">{p.category?.name ?? <span className="text-ink-soft">–</span>}</td>
                <td className="px-4 py-3.5">
                  {p.rebate_category?.name ? (
                    <span className="inline-flex rounded-full bg-[#ffe9ea] px-2.5 py-1 text-xs font-semibold text-[#f40009]">
                      {p.rebate_category.name}
                    </span>
                  ) : (
                    <span className="text-ink-soft">Not eligible</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[...p.units]
                      .filter((u) => u.is_active)
                      .sort((a, b) => a.factor - b.factor)
                      .map((u) => (
                        <span
                          key={u.unit_id}
                          className={`rounded-lg px-2 py-1 text-xs font-medium ${u.is_base ? "bg-ink text-white" : "bg-paper text-ink ring-1 ring-line"}`}
                        >
                          {u.is_base ? u.unit?.name : `${u.unit?.name} ×${u.factor}`}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="px-4 py-3.5"><StatusBadge active={p.is_active} /></td>
                <td className="px-4 py-3.5 text-right">
                  {canManage && (
                    <button
                      onClick={() => setEditing(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-[#f40009] transition hover:border-[#ff3b3f]/30 hover:bg-[#ffe9ea]"
                    >
                      <Svg d={I.edit} /> Edit
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => { if (window.confirm(`Delete ${p.name}? This cannot be undone. Products that have been stocked or sold cannot be deleted.`)) remove.mutate(p.id); }}
                      className="ml-1 inline-flex items-center rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-[#c23a3a] transition hover:border-[#c23a3a]/30 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{deleteError}</p>}

      {/* Pagination */}
      {data && data.last_page > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <span>
            Page <strong className="text-ink">{data.current_page}</strong> of {data.last_page} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <Svg d={I.left} /> Previous
            </Button>
            <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>
              Next <Svg d={I.right} />
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["list", "/products"] });
            queryClient.invalidateQueries({ queryKey: ["price-rows"] });
          }}
        />
      )}
    </div>
  );
}

type Pack = { unit_id: string; factor: string; barcode: string };

function SectionTitle({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid size-7 place-items-center rounded-lg bg-[#ffe9ea] text-xs font-bold text-[#f40009]">{n}</span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const isNew = product === null;
  const categories = useOptions("/product-categories");
  const rebateCategories = useOptions("/rebate-categories");
  const units = useOptions("/units");

  const [v, setV] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    brand: product?.brand ?? "",
    size_label: product?.size_label ?? "",
    packaging: product?.packaging ?? "other",
    category_id: String(product?.category_id ?? ""),
    rebate_category_id: String(product?.rebate_category_id ?? ""),
    base_unit_id: String(product?.base_unit_id ?? ""),
    barcode: product?.units.find((u) => u.is_base)?.barcode ?? "",
    units_per_case: String(product?.units_per_case ?? ""),
    is_returnable: product?.is_returnable ?? false,
    tracks_expiry: product?.tracks_expiry ?? false,
    expiry_alert_days: String(product?.expiry_alert_days ?? ""),
    bottle_container_id: String(product?.bottle_container_id ?? ""),
    crate_container_id: String(product?.crate_container_id ?? ""),
    is_active: product?.is_active ?? true,
  });
  const [packs, setPacks] = useState<Pack[]>(
    (product?.units ?? [])
      .filter((u) => !u.is_base && u.is_active)
      .map((u) => ({ unit_id: String(u.unit_id), factor: String(u.factor), barcode: u.barcode ?? "" })),
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // undefined = unchanged, string = new picture (data URL), null = remove
  const [picture, setPicture] = useState<string | null | undefined>(undefined);
  const [pictureError, setPictureError] = useState<string | null>(null);

  const choosePicture = async (file?: File) => {
    if (!file) return;
    setPictureError(null);
    try {
      setPicture(await shrinkImage(file));
    } catch (e) {
      setPictureError((e as Error).message);
    }
  };

  const current = useProductImage(product?.image_url);
  const shownPicture = picture === undefined ? current : picture;

  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [key]: value }));
  const text = (key: "name" | "sku" | "brand" | "size_label" | "barcode" | "units_per_case") => (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value);

  const containerTypes = useQuery({ queryKey: ["container-types"], queryFn: () => api<{ data: { id: number; name: string; kind: string }[] }>("/container-types") });
  const ofKind = (k: string) => (containerTypes.data?.data ?? []).filter((c) => c.kind === k).map((c) => ({ value: c.id, label: c.name }));

  const baseUnitName = units.find((u) => String(u.value) === v.base_unit_id)?.label ?? "base unit";

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: v.name,
        sku: v.sku,
        brand: v.brand || null,
        size_label: v.size_label || null,
        packaging: v.packaging,
        category_id: Number(v.category_id),
        rebate_category_id: v.rebate_category_id ? Number(v.rebate_category_id) : null,
        barcode: v.barcode || null,
        units_per_case: v.units_per_case ? Number(v.units_per_case) : null,
        is_returnable: v.is_returnable,
        tracks_expiry: v.tracks_expiry,
        expiry_alert_days: v.tracks_expiry && v.expiry_alert_days ? Number(v.expiry_alert_days) : null,
        bottle_container_id: v.is_returnable && v.bottle_container_id ? Number(v.bottle_container_id) : null,
        crate_container_id: v.is_returnable && v.crate_container_id ? Number(v.crate_container_id) : null,
        is_active: v.is_active,
        units: packs
          .filter((p) => p.unit_id)
          .map((p) => ({ unit_id: Number(p.unit_id), factor: Number(p.factor), barcode: p.barcode || null })),
      };
      if (isNew || Number(v.base_unit_id) !== product.base_unit_id) body.base_unit_id = Number(v.base_unit_id);

      return (isNew ? api<Product>("/products", { method: "POST", body }) : api<Product>(`/products/${product.id}`, { method: "PUT", body })).then(async (saved) => {
        const id = saved.id ?? product?.id;
        if (picture) await api(`/products/${id}/image`, { method: "POST", body: { image: picture } });
        else if (picture === null && product?.image_url) await api(`/products/${id}/image`, { method: "DELETE" });
        return saved;
      });
    },
    onSuccess: onSaved,
    onError: (e: Error) => {
      setFormError(e.message);
      setErrors(e instanceof ApiError ? (e.errors ?? {}) : {});
    },
  });

  const updatePack = (i: number, patch: Partial<Pack>) => setPacks((cur) => cur.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const toggleRow =
    "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3.5 text-sm transition hover:border-[#ff3b3f]/40 hover:bg-[#fff5f5] has-[:checked]:border-[#ff3b3f]/50 has-[:checked]:bg-[#fff1f1]";

  return (
    <Modal title={isNew ? "Add product" : `Edit ${product.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setErrors({}); setFormError(null); save.mutate(); }} className="space-y-6">
        {/* 1 — Basics */}
        <section>
          <SectionTitle n="1" title="Product details" hint="How this product is named and identified." />
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {shownPicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownPicture} alt="" className="size-20 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-line" />
              ) : (
                <span className="grid size-20 shrink-0 place-items-center rounded-2xl border border-dashed border-line bg-paper text-xs text-ink-soft">No picture</span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold transition hover:bg-[#fff5f5]">
                    {shownPicture ? "Change picture" : "Add picture"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void choosePicture(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {shownPicture && (
                    <button type="button" onClick={() => setPicture(null)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${ERR} transition hover:bg-red-50`}>
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-soft">JPEG, PNG or WebP. Resized automatically.</p>
                {(pictureError || errors.image?.[0]) && <p role="alert" className={`mt-1 text-xs ${ERR}`}>{pictureError ?? errors.image?.[0]}</p>}
              </div>
            </div>
            <Field label="Product name" value={v.name} onChange={text("name")} error={errors.name?.[0]} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU" value={v.sku} onChange={text("sku")} error={errors.sku?.[0]} hint="Your own unique code." required />
              <Field label="Brand" value={v.brand} onChange={text("brand")} error={errors.brand?.[0]} />
              <Field label="Size" value={v.size_label} onChange={text("size_label")} placeholder="50cl" error={errors.size_label?.[0]} />
              <SelectField
                label="Packaging"
                value={v.packaging}
                onChange={(x) => setV((s) => ({ ...s, packaging: x as typeof v.packaging, is_returnable: x === "rgb" ? true : s.is_returnable }))}
                options={PACKAGING}
                error={errors.packaging?.[0]}
              />
            </div>
          </div>
        </section>

        {/* 2 — Classification */}
        <section>
          <SectionTitle n="2" title="Classification" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Category" value={v.category_id} onChange={(x) => set("category_id", x)}
              options={[{ value: "", label: "Select a category" }, ...categories]} error={errors.category_id?.[0]} required />
            <SelectField label="Rebate category" value={v.rebate_category_id} onChange={(x) => set("rebate_category_id", x)}
              options={[{ value: "", label: "Not rebate-eligible" }, ...rebateCategories]} error={errors.rebate_category_id?.[0]}
              hint="Which Coca-Cola volume group this counts toward." />
          </div>
        </section>

        {/* 3 — Units */}
        <section className="rounded-2xl border border-line bg-[#fffafa] p-4">
          <SectionTitle n="3" title="Units & packs" hint="Stock is counted in the base unit; packs are bigger ways to sell it." />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Base unit" value={v.base_unit_id} onChange={(x) => { set("base_unit_id", x); setPacks((cur) => cur.filter((p) => p.unit_id !== x)); }}
              options={[{ value: "", label: "Select a unit" }, ...units]} required={isNew}
              hint={isNew ? "What stock is counted in, e.g. Bottle or Can." : "Can only be changed while the product has no stock, sales or purchases. Re-check the packs below if you change it."}
              error={errors.base_unit_id?.[0]} />
            <Field label={`Barcode (${baseUnitName})`} value={v.barcode} onChange={text("barcode")} />
            <Field label={`${baseUnitName}s in a physical case`} inputMode="numeric" value={v.units_per_case} onChange={text("units_per_case")}
              error={errors.units_per_case?.[0]} hint="How Coca-Cola counts volume for rebates. Leave empty to use the largest pack." />
          </div>

          <p className="mt-5 mb-2 text-sm font-semibold">Also sold as</p>
          <div className="space-y-3">
            {packs.length === 0 && (
              <p className="rounded-xl border border-dashed border-line bg-white px-4 py-3 text-sm text-ink-soft">
                No packs yet. Add a crate or case if you sell this in bulk.
              </p>
            )}
            {packs.map((p, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-line bg-white p-3.5 shadow-sm sm:grid-cols-[1fr_7rem_1fr_auto] sm:items-end">
                <SelectField label="Unit" value={p.unit_id} onChange={(x) => updatePack(i, { unit_id: x })}
                  options={[{ value: "", label: "Select" }, ...units.filter((u) => String(u.value) !== v.base_unit_id)]}
                  error={errors[`units.${i}.unit_id`]?.[0]} />
                <Field label={`${baseUnitName}s inside`} inputMode="numeric" value={p.factor} onChange={(e) => updatePack(i, { factor: e.target.value })}
                  error={errors[`units.${i}.factor`]?.[0]} />
                <Field label="Barcode" value={p.barcode} onChange={(e) => updatePack(i, { barcode: e.target.value })} />
                <button type="button" onClick={() => setPacks((cur) => cur.filter((_, idx) => idx !== i))}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${ERR} transition hover:bg-red-50`}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          {errors.units?.[0] && <p role="alert" className={`mt-2 text-xs ${ERR}`}>{errors.units[0]}</p>}
          {packs.length < 6 && (
            <Button type="button" variant="secondary" className="mt-3" onClick={() => setPacks((cur) => [...cur, { unit_id: "", factor: "", barcode: "" }])}>
              <Svg d={I.plus} /> Add a pack
            </Button>
          )}
        </section>

        {/* 4 — Options */}
        <section>
          <SectionTitle n="4" title="Options" />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={toggleRow}>
              <input type="checkbox" className="mt-0.5 size-4 accent-[#f40009]" checked={v.is_returnable} onChange={(e) => set("is_returnable", e.target.checked)} />
              <span>
                <span className="block font-semibold">Returnable</span>
                <span className="text-xs text-ink-soft">Bottles and crates come back.</span>
              </span>
            </label>
            <label className={toggleRow}>
              <input type="checkbox" className="mt-0.5 size-4 accent-[#f40009]" checked={v.tracks_expiry} onChange={(e) => set("tracks_expiry", e.target.checked)} />
              <span>
                <span className="block font-semibold">Track expiry dates</span>
                <span className="text-xs text-ink-soft">Record an expiry date on each delivery. Oldest stock sells first and expired stock is blocked from sale.</span>
              </span>
            </label>
            {v.tracks_expiry && (
              <label className="text-sm font-medium">
                Warn me this many days before expiry
                <input inputMode="numeric" value={v.expiry_alert_days} onChange={(e) => set("expiry_alert_days", e.target.value.replace(/[^\d]/g, ""))} placeholder="30" className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-normal" />
              </label>
            )}
            <label className={toggleRow}>
              <input type="checkbox" className="mt-0.5 size-4 accent-[#f40009]" checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              <span>
                <span className="block font-semibold">Product is active</span>
                <span className="text-xs text-ink-soft">Available to buy and sell.</span>
              </span>
            </label>
          </div>
        </section>

        {v.is_returnable && (
          <section className="rounded-2xl border border-line bg-[#fffafa] p-4">
            <SectionTitle n="5" title="Bottles and crates" hint="Which containers go out with this product, so deposits and empties can be tracked. Add container types under Stock › Crates & bottles." />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Bottle" value={v.bottle_container_id} onChange={(x) => set("bottle_container_id", x)} options={[{ value: "", label: "Not tracked" }, ...ofKind("bottle")]} error={errors.bottle_container_id?.[0]} />
              <SelectField label="Crate" value={v.crate_container_id} onChange={(x) => set("crate_container_id", x)} options={[{ value: "", label: "Not tracked" }, ...ofKind("crate")]} error={errors.crate_container_id?.[0]}
                hint="Counted once for each full crate sold." />
            </div>
          </section>
        )}

        {formError && !Object.keys(errors).length && (
          <p role="alert" className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm ${ERR}`}>{formError}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={save.isPending}>{isNew ? "Add product" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}