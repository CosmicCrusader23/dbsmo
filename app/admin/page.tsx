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
import { PageBackLink } from "@/app/page-back-link";

export const dynamic = "force-dynamic";

type AdminTool = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Parameters<typeof hasPermission>[1];
  tone: "pink" | "blue" | "yellow" | "green";
};

type AdminGroup = {
  label: string;
  description: string;
  tools: AdminTool[];
};

const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: "Content",
    description: "Create, import, publish, and maintain problem sets.",
    tools: [
      {
        href: "/admin/sets",
        label: "Manage sets",
        description: "Edit metadata, questions, answers, status, and set analytics.",
        icon: ListChecks,
        permission: "admin:content",
        tone: "pink",
      },
      {
        href: "/admin/create",
        label: "Create a set",
        description: "Build a problem set in the authoring interface.",
        icon: PenLine,
        permission: "admin:content",
        tone: "yellow",
      },
      {
        href: "/admin/import",
        label: "JSON import",
        description: "Validate and upload single files or batch ZIP archives.",
        icon: FileJson,
        permission: "admin:content",
        tone: "blue",
      },
    ],
  },
  {
    label: "People & classes",
    description: "Manage rosters, assignments, and classroom activity.",
    tools: [
      {
        href: "/admin/students",
        label: "Students",
        description: "Review student progress, attempts, and performance evidence.",
        icon: Users,
        permission: "admin:users",
        tone: "green",
      },
      {
        href: "/classes",
        label: "Classes",
        description: "Manage classes, assignments, members, and announcements.",
        icon: GraduationCap,
        permission: "admin:users",
        tone: "yellow",
      },
    ],
  },
  {
    label: "Insights & operations",
    description: "Measure performance and keep the platform healthy.",
    tools: [
      {
        href: "/admin/analytics",
        label: "Analytics",
        description: "Explore accuracy, mastery, trends, and set performance.",
        icon: BarChart3,
        permission: "admin:analytics",
        tone: "blue",
      },
      {
        href: "/admin/feedback",
        label: "Feedback queue",
        description: "Review and resolve reports submitted by students.",
        icon: MessageSquareWarning,
        permission: "admin:feedback",
        tone: "pink",
      },
      {
        href: "/admin/audit",
        label: "Audit log",
        description: "Inspect important administrative changes and actions.",
        icon: CheckCircle2,
        permission: "admin:audit",
        tone: "green",
      },
    ],
  },
];

export default async function AdminPanelPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:view")) redirect("/dashboard");

  const groups = ADMIN_GROUPS.map((group) => ({
    ...group,
    tools: group.tools.filter((tool) => hasPermission(session.user.role, tool.permission)),
  })).filter((group) => group.tools.length > 0);

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
            <p className="admin-panel-lede">
              One place for the tools used to run DBSMO.
            </p>
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
                  const Icon = tool.icon;
                  return (
                    <Link className={`admin-tool-card tone-${tool.tone}`} href={tool.href} key={tool.href}>
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
