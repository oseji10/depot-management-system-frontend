"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field } from "../../../components/ui";
import { api, ApiError } from "../../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api("/auth/forgot-password", { method: "POST", auth: false, body: { email } });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? (e.errors?.email?.[0] ?? e.message) : "Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>

      {sent ? (
        <>
          <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            If <strong>{email}</strong> has an account, a reset link is on its way. It can take a minute, and it may land in spam.
          </p>
          <p className="mt-6 text-sm text-ink-soft"><Link href="/login" className="font-semibold text-[#f40009] hover:underline">Back to sign in</Link></p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">Enter your email and we will send you a link to choose a new password.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{error}</p>}
            <Button type="submit" busy={busy} className="w-full">Send reset link</Button>
          </form>
          <p className="mt-6 text-sm text-ink-soft"><Link href="/login" className="font-semibold text-[#f40009] hover:underline">Back to sign in</Link></p>
        </>
      )}
    </>
  );
}
