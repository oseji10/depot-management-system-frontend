"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { shrinkLogo, useProductImage } from "../../../components/product-image";
import { Button, Card, ErrorNote, Field, PageHeader } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { api } from "../../../lib/api";
import { cacheSession } from "../../../lib/auth";
import type { Session } from "../../../lib/types";

/** Keep the server's fresh view of the business on this device. Returns what the server says it now holds, so the page can show it. */
async function refreshSession(): Promise<Session["store"]> {
  const fresh = await api<Session>("/auth/me");
  cacheSession(fresh);
  return fresh.store;
}

export default function BusinessPage() {
  const s = useSession();
  const current = useProductImage(s.store?.logo_url);
  const [picture, setPicture] = useState<string | null | undefined>(undefined); // undefined = unchanged, null = remove
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<Session["store"] | undefined>(undefined); // what the server reports after a save

  const [name, setName] = useState(s.store?.name ?? "");
  const [address, setAddress] = useState(s.store?.address ?? "");
  const [phone, setPhone] = useState(s.store?.phone ?? "");
  const [email, setEmail] = useState(s.store?.email ?? "");

  // The page can open on the copy of the session saved on this device, before the server's newer one arrives. Follow it until the person starts typing.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) return;
    setName(s.store?.name ?? ""); setAddress(s.store?.address ?? ""); setPhone(s.store?.phone ?? ""); setEmail(s.store?.email ?? "");
  }, [s.store?.name, s.store?.address, s.store?.phone, s.store?.email]);
  const saveDetails = useMutation({
    mutationFn: () => api("/business", { method: "PUT", body: { name, address: address || null, phone: phone || null, email: email || null } }),
    onSuccess: async () => setSaved(await refreshSession()),
  });

  const shown = picture === undefined ? current : picture;

  async function choose(file?: File) {
    if (!file) return;
    setProblem(null);
    try { setPicture(await shrinkLogo(file)); } catch (e) { setProblem((e as Error).message); }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (picture) await api("/business/logo", { method: "POST", body: { image: picture } });
      else if (picture === null) await api("/business/logo", { method: "DELETE" });
    },
    // The session carries the logo address, so reload to pick up the new one everywhere (receipts, menu).
    onSuccess: async () => setSaved(await refreshSession()),
  });

  return (
    <>
      <PageHeader title="My business" description="Your business name, address and logo appear on every printed receipt." />

      {saved !== undefined && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <p className="font-semibold">Saved. The server now holds:</p>
          <p>Name: {saved?.name || "(empty)"} · Address: {saved?.address || "(empty)"} · Phone: {saved?.phone || "(empty)"} · Email: {saved?.email || "(empty)"} · Logo: {saved?.logo_url ? "yes" : "none"}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Reload to use it everywhere</button>
        </div>
      )}

      <Card title="Business details">
        <form onSubmit={(e) => { e.preventDefault(); saveDetails.mutate(); }} className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" value={name} onChange={(e) => { touched.current = true; setName(e.target.value); }} required className="sm:col-span-2" />
          <Field label="Address" value={address} onChange={(e) => { touched.current = true; setAddress(e.target.value); }} />
          <Field label="Phone" value={phone} onChange={(e) => { touched.current = true; setPhone(e.target.value); }} />
          <Field label="Email" type="email" value={email} onChange={(e) => { touched.current = true; setEmail(e.target.value); }} />
          <div className="sm:col-span-2">
            {saveDetails.error && <div className="mb-2"><ErrorNote>{(saveDetails.error as Error).message}</ErrorNote></div>}
            <Button type="submit" busy={saveDetails.isPending} disabled={!name.trim()}>Save details</Button>
          </div>
        </form>
      </Card>

      <div className="h-4" />

      <Card title="Logo">
        <div className="flex flex-wrap items-center gap-5">
          <div className="grid size-28 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-paper">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Business logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-ink-soft">No logo yet</span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-ink-soft">PNG, JPEG or WebP. A square or wide logo on a plain or transparent background prints best.</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold shadow-sm hover:border-[#ff3b3f]/40">
                {shown ? "Choose another" : "Choose a logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {shown && <Button variant="danger" type="button" onClick={() => setPicture(null)}>Remove</Button>}
              <Button type="button" busy={save.isPending} disabled={picture === undefined} onClick={() => save.mutate()}>Save logo</Button>
            </div>
          </div>
        </div>
        {(problem || save.error) && <div className="mt-3"><ErrorNote>{problem ?? (save.error as Error).message}</ErrorNote></div>}
      </Card>
    </>
  );
}
