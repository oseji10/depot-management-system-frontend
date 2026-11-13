"use client";

import { Badge, PageHeader } from "../../../components/ui";
import { useSession } from "../../../hooks/session";
import { NAV_RULES } from "../../../lib/nav-rules";

/** Explains, menu by menu, why something is or is not in the sidebar for the signed-in person. */
export default function AccessPage() {
  const s = useSession();
  const isRep = !!s.van;
  const off = new Set(s.store?.disabled_menus ?? []);
  const permList = s.permissions.includes("*") ? ["everything"] : s.permissions;

  const rows = NAV_RULES.map((r) => {
    let why: string | null = null;
    if (r.platformOnly && !s.isPlatform) why = "Only for the platform super admin.";
    else if (r.notPlatform && s.isPlatform) why = "Only for a business's own users.";
    else if (off.has(r.href)) why = "Switched off for your business (Stores → Menus, by the platform admin).";
    else if (isRep && (r.notRep || !["/", "/pos", "/sales", "/customers", "/expenses"].includes(r.href))) why = `This account is a salesperson (it has a van), and salespeople only get a short menu.`;
    else if (r.repOnly && !isRep) why = "Only shown to salespeople.";
    else if (r.perm && !s.can(r.perm)) why = `Your role is missing the permission “${r.perm}”.`;
    return { ...r, why };
  });
  const hidden = rows.filter((r) => r.why);

  return (
    <>
      <PageHeader title="My access" description="Why a menu is or isn't showing for you." />

      <section className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-soft">Signed in as</dt><dd className="font-semibold">{s.user.name} · {s.user.email}</dd></div>
          <div><dt className="text-ink-soft">Role</dt><dd className="font-semibold">{s.roles.length ? s.roles.join(", ") : "No role assigned"}</dd></div>
          <div><dt className="text-ink-soft">Level</dt><dd className="font-semibold">{s.level === "platform" ? "Platform super admin" : s.level === "store" ? "Whole business" : `One branch (${s.branch?.name ?? "—"})`}</dd></div>
          <div><dt className="text-ink-soft">Business</dt><dd className="font-semibold">{s.store?.name ?? "—"}</dd></div>
          <div><dt className="text-ink-soft">Permissions</dt><dd className="font-semibold">{s.permissions.includes("*") ? "All" : `${s.permissions.length}`}</dd></div>
          <div><dt className="text-ink-soft">Menus hidden from you</dt><dd className="font-semibold">{hidden.length} of {rows.length}</dd></div>
        </dl>
        {s.roles.length === 0 && !s.isPlatform && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">You have no role, so no menus. Ask an administrator to assign one under Users.</p>}
      </section>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-line bg-[#fff5f5] text-[11px] tracking-wider text-ink-soft uppercase">
            <tr><th className="px-4 py-2.5 font-medium">Menu</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Why</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.href + r.label}>
                <td className="px-4 py-2.5 font-medium">{r.label}</td>
                <td className="px-4 py-2.5">{r.why ? <Badge tone="warn">Hidden</Badge> : <Badge tone="good">Visible</Badge>}</td>
                <td className="px-4 py-2.5 text-ink-soft">{r.why ?? (r.perm ? `Has “${r.perm}”.` : "Available.")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-4 text-sm text-ink-soft">
        <summary className="cursor-pointer font-medium">All my permissions</summary>
        <p className="mt-2 break-words">{permList.join(", ") || "None"}</p>
      </details>
    </>
  );
}
