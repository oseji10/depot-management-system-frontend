"use client";

import { Logo } from "./logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "../hooks/session";
import { api } from "../lib/api";
import { setStoreId, signOutLocally } from "../lib/auth";
import { NotificationBell, NotificationToasts } from "./notifications";
import { useProductImage } from "./product-image";
import { useOffline } from "./offline-provider";
import { SyncChip } from "./sync-status";
import { APP_NAME } from "../lib/brand";
import type { Paginated, Store } from "../lib/types";
import { SubscriptionBanner, SubscriptionGate } from "./subscription-banner";
import { BusinessSwitcher, ScopeSwitcher } from "./workspace-switcher";

type IconName =
  | "dashboard" | "products" | "categories" | "rebate" | "units" | "price"
  | "stores" | "branches" | "warehouses" | "users" | "roles" | "audit" | "logout"
  | "suppliers" | "orders" | "receipts" | "discrepancy"
  | "stock" | "movements" | "adjust" | "transfer" | "count"
  | "accounts" | "journal" | "periods" | "reports" | "calc" | "agreement"
  | "pos" | "sales" | "customers" | "van" | "route" | "expenses" | "sync";

type NavItem = { href: string; label: string; icon: IconName; show: boolean };
type NavSection = { title?: string; items: NavItem[] };

const ICONS: Record<IconName, string> = {
  dashboard: "M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z",
  products: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  categories: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  rebate: "M19 5 5 19M7.5 8h.01M16.5 17h.01",
  units: "M3 17 17 3l4 4L7 21l-4-4ZM7 13l2 2M10 10l2 2M13 7l2 2",
  price: "M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01",
  stores: "M3 9l1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8",
  branches: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 12h.01",
  warehouses: "M3 10 12 4l9 6v10H3V10ZM8 20v-6h8v6",
  users: "M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6",
  roles: "M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3ZM9 12l2 2 4-4",
  audit: "M8 4h8v3H8V4ZM6 5H5v16h14V5h-1M9 12h6M9 16h6",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  suppliers: "M3 7h11v9H3V7ZM14 10h4l3 3v3h-7v-6ZM7 19a1.5 1.5 0 1 0 0-.01M17 19a1.5 1.5 0 1 0 0-.01",
  orders: "M7 3h10v4H7V3ZM5 5H4v16h16V5h-1M8 12h8M8 16h5",
  receipts: "M4 4h16v16H4V4ZM8 12l3 3 5-6",
  discrepancy: "M12 3 2 20h20L12 3ZM12 10v4M12 17h.01",
  stock: "M3 7l9-4 9 4-9 4-9-4ZM3 12l9 4 9-4M3 17l9 4 9-4",
  movements: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  adjust: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  transfer: "M3 12h14M13 7l5 5-5 5M21 4v16",
  count: "M5 4h14v16H5V4ZM9 9l1.5 1.5L13 8M9 15h6",
  accounts: "M4 5h16v4H4V5ZM4 11h16v8H4v-8ZM8 11v8",
  journal: "M6 3h12v18H6V3ZM9 8h6M9 12h6M9 16h3",
  periods: "M4 6h16v14H4V6ZM8 3v4M16 3v4M4 11h16",
  reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  calc: "M6 3h12v18H6V3ZM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  agreement: "M7 3h8l4 4v14H7V3ZM15 3v4h4M10 12h6M10 16h4",
  pos: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6M9 20.5h.01M17 20.5h.01",
  sales: "M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6",
  customers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  van: "M2 6h11v10H2V6ZM13 9h4l4 3.5V16h-8V9ZM6.5 19.5a1.8 1.8 0 1 0 0-.01M17 19.5a1.8 1.8 0 1 0 0-.01",
  expenses: "M4 7h16v12H4V7ZM4 11h16M8 15h3M9 7V4h6v3",
  sync: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  route: "M6 19a2.5 2.5 0 1 0 0-.01M18 5a2.5 2.5 0 1 0 0-.01M8.5 19H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5",
};

function Icon({ name, className = "size-[18px]" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function isActive(href: string, pathname: string, all: string[]) {
  if (href === "/") return pathname === "/";
  if (pathname !== href && !pathname.startsWith(href + "/")) return false;
  // a more specific nav item (e.g. /stock/movements) wins over its parent (/stock)
  return !all.some((o) => o !== href && o.startsWith(href + "/") && (pathname === o || pathname.startsWith(o + "/")));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export function Shell({ activeStoreId, children }: { activeStoreId: string | null; children: ReactNode }) {
  const s = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wide = pathname === "/pos"; // the till wants every pixel
  const offline = useOffline();
  const logo = useProductImage(s.store?.logo_url);
  const isRep = !!s.van; // salespeople get a short menu: their van, the till, their sales and customers

  // Close the drawer with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sections: NavSection[] = [
    { items: [{ href: "/", label: isRep ? "My van" : "Dashboard", icon: isRep ? "van" : "dashboard", show: true }] },
    {
      title: "Sales",
      items: [
        { href: "/pos", label: "Point of sale", icon: "pos", show: s.can("sales.create") },
        { href: "/sales", label: "Sales", icon: "sales", show: s.can("sales.view") },
        { href: "/proformas", label: "Proforma invoices", icon: "sales", show: s.can("proformas.view") && !isRep },
        { href: "/customers", label: "Customers", icon: "customers", show: s.can("customers.view") },
        { href: "/customers/insights", label: "Customer insights", icon: "customers", show: s.can("customers.view") && !isRep },
        { href: "/customers/aging", label: "Who owes us", icon: "customers", show: s.can("customers.view") && !isRep },
        { href: "/returns", label: "Returns", icon: "sales", show: s.can("sales.view") && !isRep },
        { href: "/expenses", label: "My expenses", icon: "expenses", show: isRep && s.can("expenses.view") },
      ],
    },
    {
      title: "Field sales & fleet",
      items: [
        { href: "/field", label: "Salespeople", icon: "van", show: s.can("trips.view") },
        { href: "/field/trips", label: "Trips", icon: "route", show: s.can("trips.view") },
        { href: "/field/issues", label: "Sync issues", icon: "sync", show: s.can("trips.view") },
        { href: "/targets", label: "Sales targets", icon: "reports", show: !isRep && s.can("targets.view") },
        { href: "/vehicles", label: "Vehicles", icon: "van", show: !isRep && s.can("vehicles.view") },
        { href: "/fuel", label: "Fuel stations & vouchers", icon: "van", show: !isRep && s.can("fuel.view") },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/products", label: "Products", icon: "products", show: s.can("products.view") },
        { href: "/categories", label: "Categories", icon: "categories", show: s.can("products.view") },
        { href: "/rebate-categories", label: "Rebate categories", icon: "rebate", show: s.can("products.view") },
                { href: "/units", label: "Units", icon: "units", show: s.can("products.view") },
        { href: "/price-lists", label: "Price lists", icon: "price", show: s.can("pricing.view") },
        { href: "/promotions", label: "Promotions", icon: "rebate", show: s.can("pricing.view") },
      ],
    },
    {
      title: "Purchasing",
      items: [
        { href: "/suppliers", label: "Suppliers", icon: "suppliers", show: s.can("purchasing.view") },
        { href: "/purchase-orders", label: "Purchase orders", icon: "orders", show: s.can("purchasing.view") },
        { href: "/goods-receipts", label: "Goods receipts", icon: "receipts", show: s.can("goods-receipts.view") },
        { href: "/discrepancies", label: "Discrepancies", icon: "discrepancy", show: s.can("purchasing.view") },
      ],
    },
    {
      title: "Stock",
      items: [
        { href: "/stock", label: "Stock on hand", icon: "stock", show: s.can("inventory.view") },
        { href: "/stock/reorder", label: "What to reorder", icon: "stock", show: s.can("inventory.view") },
        { href: "/stock/expiry", label: "Expiry dates", icon: "periods", show: s.can("inventory.view") },
        { href: "/stock/movements", label: "Movements", icon: "movements", show: s.can("inventory.view") },
        { href: "/stock-adjustments", label: "Adjustments", icon: "adjust", show: s.can("inventory.view") },
        { href: "/stock-transfers", label: "Transfers", icon: "transfer", show: s.can("inventory.view") },
        { href: "/stock-counts", label: "Stock counts", icon: "count", show: s.can("inventory.view") },
        { href: "/containers", label: "Crates & bottles", icon: "transfer", show: s.can("containers.view") },
      ],
    },
    {
      title: "Rebates",
      items: [
        { href: "/rebates", label: "Rebates", icon: "calc", show: s.can("rebates.view") },
        { href: "/rebate-agreements", label: "Rebate agreements", icon: "agreement", show: s.can("rebates.view") },
      ],
    },
    {
      title: "HR & payroll",
      items: [
        { href: "/employees", label: "Employees", icon: "users", show: !isRep && s.can("employees.view") },
        { href: "/payroll", label: "Payroll", icon: "calc", show: !isRep && s.can("payroll.view") },
        { href: "/payroll/schedule", label: "Salary schedule", icon: "calc", show: !isRep && s.can("payroll.view") },
        { href: "/staff-charges", label: "Staff charges", icon: "discrepancy", show: !isRep && s.can("staff-charges.view") },
      ],
    },
    {
      title: "Accounting",
      items: [
        { href: "/pos-terminals", label: "Card terminals", icon: "pos", show: !isRep && s.can("terminals.view") },
        { href: "/bank-accounts", label: "Bank accounts", icon: "accounts", show: !isRep && s.can("accounts.view") },
        { href: "/expenses", label: "Expenses", icon: "expenses", show: !isRep && s.can("expenses.view") },
        { href: "/accounts", label: "Chart of accounts", icon: "accounts", show: s.can("accounts.view") },
        { href: "/journals", label: "Journals", icon: "journal", show: s.can("accounts.view") },
        { href: "/bank-reconciliation", label: "Bank reconciliation", icon: "journal", show: s.can("accounts.view") },
        { href: "/fiscal-periods", label: "Periods", icon: "periods", show: s.can("accounts.view") },
        { href: "/reports", label: "Reports", icon: "reports", show: s.can("reports.view") },
      ],
    },
    {
      title: "Organization",
      items: [
        { href: "/stores", label: "Stores", icon: "stores", show: s.isPlatform },
        { href: "/business", label: "My business", icon: "stores", show: s.can("business.manage") },
        { href: "/subscription", label: "Subscription", icon: "reports", show: s.can("business.manage") && !s.isPlatform },
        { href: "/subscriptions", label: "Subscriptions", icon: "reports", show: s.isPlatform },
        { href: "/branches", label: "Branches", icon: "branches", show: s.can("branches.view") },
        { href: "/warehouses", label: "Warehouses", icon: "warehouses", show: s.can("warehouses.view") },
        { href: "/users", label: "Users", icon: "users", show: s.can("users.view") },
        { href: "/roles", label: "Roles", icon: "roles", show: s.can("roles.view") },
        { href: "/audit-logs", label: "Audit log", icon: "audit", show: s.can("audit.view") },
        { href: "/imports", label: "Upload history", icon: "audit", show: s.can("audit.view") },
      ],
    },
  ];

  if (isRep) {
    const keep = new Set(["/", "/pos", "/sales", "/customers", "/expenses"]);
    for (const sec of sections) sec.items = sec.items.filter((n) => keep.has(n.href));
  }

  // Menus the platform has switched off for this business.
  const switchedOff = new Set(s.store?.disabled_menus ?? []);
  if (switchedOff.size) for (const sec of sections) sec.items = sec.items.filter((n) => !switchedOff.has(n.href));

  const allHrefs = sections.flatMap((x) => x.items.filter((n) => n.show).map((n) => n.href));

  async function logout() {
    const waiting = (offline?.pending ?? 0) + (offline?.rejected ?? 0);
    if (waiting > 0 && !window.confirm(`${waiting} sale${waiting === 1 ? "" : "s"} or expense${waiting === 1 ? "" : "s"} on this phone ${waiting === 1 ? "has" : "have"} not reached the depot yet. They stay safe on this phone, but you must sign in again and get a signal to send them. Sign out anyway?`)) return;
    // Pages saved for offline use belong to this sign-in; remove them.
    // (Only salesperson phones register a service worker; awaiting `ready` anywhere else would never finish.)
    if (isRep) {
      try {
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((r) => setTimeout(r, 1500))]);
        reg?.active?.postMessage({ type: "clear" });
        sessionStorage.removeItem("depot.warm");
      } catch { /* ignore */ }
    }
    try { await api("/auth/logout", { method: "POST" }); } catch { /* token already invalid, or no signal: sign out here anyway */ }
    signOutLocally();
    router.replace("/login/");
  }

  const scopeLabel =
    s.level === "platform" ? "Platform admin" : s.level === "store" ? "All branches" : (s.branch?.name ?? "Branch");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[19rem_1fr] print:block">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#c40008]/95 px-4 py-3 text-white backdrop-blur lg:hidden print:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/15"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </button>
        <span className="truncate px-3 text-sm font-semibold">{s.store?.name ?? APP_NAME}</span>
        {isRep && <SyncChip compact />}
        <NotificationBell className="mr-2" />
        {logo ? (
          <BrandMark logo={logo} className="size-9 rounded-lg text-sm" />
        ) : (
          <span className="grid h-9 place-items-center rounded-lg bg-white px-2"><Logo className="h-6" /></span>
        )}
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[85vw] flex-col overflow-hidden bg-gradient-to-b from-[#ff3b3f] to-[#a50006] text-white shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-16 size-64 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/15 to-transparent"
        />

        {/* Brand */}
        <div className="relative px-4 pt-5">
          <div className="grid place-items-center rounded-2xl bg-white px-3 py-2 shadow-lg shadow-black/20 ring-1 ring-white/40">
            <Logo className="h-10" />
          </div>
        </div>
        <div className="relative flex items-center gap-3 px-5 pt-4 pb-4">
          {logo && <BrandMark logo={logo} className="size-10 rounded-xl text-lg shadow-lg shadow-black/20 ring-1 ring-white/40" />}
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-bold tracking-tight">{s.store?.name ?? APP_NAME}</p>
            <p className="truncate text-xs text-white/90">{s.store ? "Depot Management System" : "All stores"}</p>
          </div>
          <NotificationBell className="ml-auto hidden lg:block" />
        </div>

        {s.isPlatform && <StoreSwitcher activeStoreId={activeStoreId} />}
        {!s.isPlatform && !isRep && <BusinessSwitcher />}
        {!isRep && <ScopeSwitcher />}

        {s.can("sales.create") && pathname !== "/pos" && (
          <div className="relative px-4 pb-1">
            <Link
              href="/pos"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#a50006] shadow-lg shadow-black/15 transition hover:bg-[#fff3f3] active:scale-[0.98]"
            >
              <Icon name="pos" /> New sale
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]" aria-label="Main">
          {sections.map((section) => {
            const items = section.items.filter((n) => n.show);
            if (!items.length) return null;

            return (
              <div key={section.title ?? "main"}>
                {section.title && (
                  <p className="mb-1.5 px-3 text-[11px] font-bold tracking-[0.14em] text-white uppercase">
                    {section.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((n) => {
                    const active = isActive(n.href, pathname, allHrefs);
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? "bg-gradient-to-r from-white/25 via-white/10 to-transparent font-semibold text-white"
                            : "font-medium text-white hover:bg-white/15"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white shadow-[0_0_12px_2px_rgb(255_255_255/0.55)]" />
                        )}
                        <Icon
                          name={n.icon}
                          className={`size-[18px] shrink-0 transition-colors ${
                            active ? "text-white" : "text-white group-hover:text-white"
                          }`}
                        />
                        <span className="truncate">{n.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {isRep && <div className="relative px-4 pb-1"><SyncChip /></div>}

        {/* Who is signed in: just the name and role */}
        <div className="relative px-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/25 to-white/5 text-xs font-bold ring-1 ring-white/20">
              {initials(s.user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.user.name}</p>
              <p className="truncate text-xs text-white/90">
                {s.roles[0] ?? (s.isPlatform ? "Super admin" : "No role")} · {scopeLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Sign out: its own big button */}
        <div className="relative p-3 pt-2">
          <button
            onClick={logout}
            className="group flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#ff8a3d] via-[#ff5e62] to-[#f40009] px-4 text-[15px] font-extrabold tracking-wide text-white shadow-lg shadow-[#f40009]/30 ring-1 ring-white/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#f40009]/40 active:translate-y-0 active:scale-[0.98]"
          >
            <Icon name="logout" className="size-5 transition-transform group-hover:translate-x-0.5" />
            Sign out
          </button>
        </div>
      </aside>

      <NotificationToasts />
      <main className={`min-w-0 px-4 py-6 sm:px-8 sm:py-8 ${wide ? "lg:px-5 lg:py-5" : ""}`}><div className={`mx-auto ${wide ? "max-w-none" : "max-w-6xl"}`}><SubscriptionBanner />{s.subscription?.mode === "blocked" && !s.isPlatform && pathname !== "/subscription/" && pathname !== "/subscription" ? <SubscriptionGate /> : children}</div></main>
    </div>
  );
}

function StoreSwitcher({ activeStoreId }: { activeStoreId: string | null }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["store-switcher"],
    queryFn: () => api<Paginated<Store>>("/stores?per_page=100"),
  });

  async function change(value: string) {
    setStoreId(value || null);
    queryClient.clear(); // every cached list belongs to the previous store view
    window.location.reload();
  }

  return (
    <div className="relative px-4 pb-3">
      <label htmlFor="store-switch" className="mb-1.5 block text-[11px] font-bold tracking-[0.14em] text-white uppercase">
        Viewing
      </label>
      <div className="relative">
        <select
          id="store-switch"
          value={activeStoreId ?? ""}
          onChange={(e) => change(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/15 bg-white/[0.06] py-2.5 pr-9 pl-3 text-sm text-white transition hover:bg-white/10 focus:border-white focus:outline-none"
        >
          <option value="" className="text-ink">All stores</option>
          {data?.data.map((st) => (
            <option key={st.id} value={st.id} className="text-ink">
              {st.name}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/90" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
/** The business logo on a white tile (so dark logos stay readable on the green menu); the app's first letter until one is uploaded. */
function BrandMark({ logo, className = "" }: { logo: string | null; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-white font-bold text-[#a50006] ${className}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-full object-contain p-1" />
      ) : (
        APP_NAME.charAt(0)
      )}
    </span>
  );
}
