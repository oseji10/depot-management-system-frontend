"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "../../../components/ui";
import { api, ApiError } from "../../../lib/api";
import { signIn } from "../../../lib/auth";
import type { Session } from "../../../lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const { token, ...session } = await api<Session & { token: string }>("/auth/login", { method: "POST", auth: false, body: { email, password, device_name: "web" } });
      signIn(token, session);
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError ? (e.errors?.email?.[0] ?? e.message) : "Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-ink-soft">Use the email and password for your depot account.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#c23a3a]">{error}</p>}

        <div className="text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-[#f40009] hover:underline">Forgot password?</Link>
        </div>

        <Button type="submit" busy={busy} className="w-full">Sign in</Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        New depot?{" "}
        <Link href="/register" className="font-semibold text-[#f40009] hover:underline">Set up your store</Link>
      </p>
    </>
  );
}
