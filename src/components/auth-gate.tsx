"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SessionProvider } from "../hooks/session";
import { API_URL, authHeaders, cacheSession, cachedSession, getStoreId, getToken, signOutLocally } from "../lib/auth";
import type { Session } from "../lib/types";
import { OfflineProvider } from "./offline-provider";
import { Providers } from "./providers";
import { Shell } from "./shell";

/**
 * The site is static, so there is no server to check the sign-in. This does it in the browser: no token means the login page;
 * the saved session shows the app straight away (and works with no signal) while the server confirms it in the background.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login/");
      return;
    }

    const saved = cachedSession();
    if (saved) setSession(saved);
    setProblem(null);

    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });

      if (res.status === 401 || res.status === 403) {
        signOutLocally();
        router.replace("/login/");
        return;
      }

      if (!res.ok) throw new Error(String(res.status));

      const fresh = (await res.json()) as Session;
      cacheSession(fresh);
      setSession(fresh);
    } catch {
      if (!saved) setProblem("Could not reach the server. Check your connection and try again.");
    }
  }, [router]);

  useEffect(() => { void check(); }, [check]);

  // Pick up role and menu changes without signing out: refresh the permissions when the person comes back to the tab.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 20_000) return;
      last = Date.now();
      void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [check]);

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        {problem ? (
          <div>
            <p className="font-semibold">{problem}</p>
            <button type="button" onClick={() => void check()} className="mt-4 min-h-11 rounded-xl bg-[#f40009] px-5 text-sm font-semibold text-white">Try again</button>
          </div>
        ) : (
          <div className="size-8 animate-spin rounded-full border-2 border-line border-t-[#f40009]" role="status" aria-label="Loading" />
        )}
      </div>
    );
  }

  return (
    <SessionProvider session={session}>
      <Providers>
        <OfflineProvider>
          <Shell activeStoreId={session.level === "platform" ? getStoreId() : null}>{children}</Shell>
        </OfflineProvider>
      </Providers>
    </SessionProvider>
  );
}
