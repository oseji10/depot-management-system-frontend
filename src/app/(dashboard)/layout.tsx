import { AuthGate } from "../../components/auth-gate";

// The site is exported as static files, so the sign-in is checked in the browser (see AuthGate).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
