"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "../../../components/ui";
import { api, ApiError } from "../../../lib/api";
import { signIn } from "../../../lib/auth";
import type { Session } from "../../../lib/types";

type Errors = Record<string, string[]>;

export default function RegisterPage() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", phone: "", branch_name: "", owner_name: "", owner_email: "", owner_password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);

    try {
      const { token, ...session } = await api<Session & { token: string }>("/auth/register-store", { method: "POST", auth: false, body: v });
      signIn(token, session);
      router.replace("/");
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setErrors(err?.errors ?? {});
      setFormError(err?.errors ? null : (err?.message ?? "Could not reach the server. Check your connection and try again."));
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Set up your depot</h1>
      <p className="mt-1 text-sm text-ink-soft">
        We create your store, a head office branch and a main warehouse. You become the owner and can add everything else after.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Depot name" value={v.name} onChange={set("name")} error={errors.name?.[0]} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" value={v.phone} onChange={set("phone")} error={errors.phone?.[0]} />
          <Field label="First branch name" value={v.branch_name} onChange={set("branch_name")} placeholder="Head Office" error={errors.branch_name?.[0]} />
        </div>

        <hr className="border-line" />

        <Field label="Your full name" value={v.owner_name} onChange={set("owner_name")} error={errors.owner_name?.[0]} required />
        <Field label="Your email" type="email" autoComplete="username" value={v.owner_email} onChange={set("owner_email")} error={errors.owner_email?.[0]} required />
        <Field label="Password" type="password" autoComplete="new-password" value={v.owner_password} onChange={set("owner_password")} hint="At least 8 characters." error={errors.owner_password?.[0]} required />

        {formError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{formError}</p>}

        <Button type="submit" busy={busy} className="w-full">Create my depot</Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#f40009] hover:underline">Sign in</Link>
      </p>
    </>
  );
}
