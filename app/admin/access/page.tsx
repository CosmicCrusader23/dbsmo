import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions, HIDDEN_ALLOWED_EMAIL, SCHOOL_EMAIL_DOMAINS } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { ensureLegacyAllowlistImported } from "@/lib/auth-allowlist";
import { PageBackLink } from "@/app/page-back-link";
import { AllowlistManager, RemoveAllowlistEntryButton } from "./allowlist-manager";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:allowlist")) redirect("/dashboard");

  await ensureLegacyAllowlistImported();
  const managedEntries = await prisma.authAllowlistEntry.findMany({
    where: { value: { not: HIDDEN_ALLOWED_EMAIL } },
    orderBy: [{ kind: "asc" }, { value: "asc" }],
    select: { id: true, kind: true, value: true },
  });
  const entries = [
    ...SCHOOL_EMAIL_DOMAINS.map((value) => ({
      id: `environment:${value}`,
      kind: "DOMAIN" as const,
      value,
      source: "environment" as const,
      deletable: false,
    })),
    ...managedEntries.map((entry) => ({
      ...entry,
      source: "admin" as const,
      deletable: true,
    })),
  ];

  return (
    <main className="single-page">
      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Email access</h1>
          </div>
          <div className="topbar-actions">
            <PageBackLink destination="Admin tools" href="/admin" />
          </div>
        </header>

        <section className="panel" style={{ marginBottom: 20, padding: 24 }}>
          <p className="eyebrow">Sign-in allowlist</p>
          <h2>Whitelist an email or domain</h2>
          <p>Add an exact email address, or a domain to allow every address at that domain.</p>
          <AllowlistManager />
        </section>

        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Active rules</p>
              <h2>
                {entries.length} whitelisted {entries.length === 1 ? "entry" : "entries"}
              </h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Email or domain</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.kind === "EMAIL" ? "Email" : "Domain"}</td>
                    <td>
                      <code>{entry.value}</code>
                    </td>
                    <td>{entry.source}</td>
                    <td>
                      {entry.deletable ? (
                        <RemoveAllowlistEntryButton entryId={entry.id} value={entry.value} />
                      ) : (
                        "Managed"
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No custom allowlist entries yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p style={{ padding: "0 20px 18px" }}>
            Environment domains and built-in entries are read-only here. Custom entries can be
            removed. Your personal sign-in exception remains hidden from this list.
          </p>
        </section>
      </div>
    </main>
  );
}
