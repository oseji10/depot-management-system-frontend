"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { withSuspense } from "../../../components/suspense-page";
import { Button, Field } from "../../../components/ui";
import { api, ApiError } from "../../../lib/api";

function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await api("/auth/reset-password", { method: "POST", auth: false, body: { token, email, password, password_confirmation: confirm } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? (e.errors?.password?.[0] ?? e.errors?.email?.[0] ?? e.message) : "Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !email) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Reset link not valid</h1>
        <p className="mt-2 text-sm text-ink-soft">Open the link from your email again, or ask for a new one.</p>
        <p className="mt-6 text-sm"><Link href="/forgot-password" className="font-semibold text-[#f40009] hover:underline">Send me a new link</Link></p>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Password changed</h1>
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">You can now sign in with your new password. Any other devices were signed out.</p>
        <p className="mt-6"><Link href="/login" className="font-semibold text-[#f40009] hover:underline">Go to sign in</Link></p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-ink-soft">For {email}. Use at least 8 characters.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{error}</p>}
        <Button type="submit" busy={busy} className="w-full">Change password</Button>
      </form>
    </>
  );
}

export default withSuspense(ResetPasswordPage);
