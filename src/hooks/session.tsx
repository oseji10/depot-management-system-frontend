"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "../lib/types";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside the dashboard layout");

  const can = (permission: string) => session.permissions.includes("*") || session.permissions.includes(permission);

  return { ...session, can, isPlatform: session.level === "platform" };
}
