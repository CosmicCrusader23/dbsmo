import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  FileJson,
  GraduationCap,
  ListChecks,
  MessageSquareWarning,
  PenLine,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ADMIN_TOOL_DEFINITIONS } from "@/lib/admin-tools";
import { PageBackLink } from "@/app/page-back-link";

export const dynamic = "force-dynamic";

const ADMIN_ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  CheckCircle2,
  FileJson,
  GraduationCap,
  ListChecks,
  MessageSquareWarning,
  PenLine,
  Users,
};

export default async function AdminPanelPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:view")) redirect("/dashboard");

  const groups = Array.from(
    ADMIN_TOOL_DEFINITIONS.filter((tool) => hasPermission(session.user.role, tool.permission))
      .reduce((groupMap, tool) => {
        const group = groupMap.get(tool.group) ?? {
          label: tool.group,
          description: tool.groupDescription,
          tools: [],
        };
        group.tools.push(tool);
        groupMap.set(tool.group, group);
        return groupMap;
      }, new Map<string, { label: string; description: string; tools: (typeof ADMIN_TOOL_DEFINITIONS)[number][] }>())
      .values(),
  );

  return (
    <main className="single-page admin-panel-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-one" />
      </div>

      <div className="page-frame">
        <header className="topbar standalone admin-panel-header">
          <div>
            <p className="eyebrow">Staff workspace</p>
            <h1>Admin Panel</h1>
            <p className="admin-panel-lede">One place for the tools used to run DBSMO.</p>
          </div>
          <PageBackLink destination="Dashboard" href="/dashboard" />
        </header>

        <section className="admin-panel-intro" aria-label="Admin access summary">
          <div className="admin-panel-intro-icon" aria-hidden="true">
            <ShieldCheck size={26} />
          </div>
          <div>
            <p className="eyebrow">Workspace access</p>
            <h2>Tools for your role</h2>
            <p>Only the sections available to your account are shown here.</p>
          </div>
        </section>

        <div className="admin-tool-groups">
          {groups.map((group) => (
            <section className="admin-tool-group" key={group.label}>
              <div className="admin-tool-group-heading">
                <div>
                  <p className="eyebrow">Admin tools</p>
                  <h2>{group.label}</h2>
                </div>
                <p>{group.description}</p>
              </div>
              <div className="admin-tool-grid">
                {group.tools.map((tool) => {
                  const Icon = ADMIN_ICON_MAP[tool.icon] ?? CheckCircle2;
                  return (
                    <Link
                      className={`admin-tool-card tone-${tool.tone}`}
                      href={tool.href}
                      key={tool.href}
                    >
                      <span className="admin-tool-icon" aria-hidden="true">
                        <Icon size={22} />
                      </span>
                      <span className="admin-tool-copy">
                        <strong>{tool.label}</strong>
                        <span>{tool.description}</span>
                      </span>
                      <span className="admin-tool-arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
