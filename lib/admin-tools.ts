import type { UserRole } from "@prisma/client";
import { hasPermission, type Permission } from "./permissions";

export type AdminToolDefinition = {
  href: string;
  label: string;
  description: string;
  icon: string;
  permission: Permission;
  tone: "pink" | "blue" | "yellow" | "green";
  group: string;
  groupDescription: string;
};

export const ADMIN_TOOL_DEFINITIONS: readonly AdminToolDefinition[] = [
  {
    href: "/admin/sets",
    label: "Manage sets",
    description: "Edit metadata, questions, answers, status, and set analytics.",
    icon: "ListChecks",
    permission: "admin:content",
    tone: "pink",
    group: "Content",
    groupDescription: "Create, import, publish, and maintain problem sets.",
  },
  {
    href: "/admin/create",
    label: "Create a set",
    description: "Build a problem set in the authoring interface.",
    icon: "PenLine",
    permission: "admin:content",
    tone: "yellow",
    group: "Content",
    groupDescription: "Create, import, publish, and maintain problem sets.",
  },
  {
    href: "/admin/import",
    label: "JSON import",
    description: "Validate and upload single files or batch ZIP archives.",
    icon: "FileJson",
    permission: "admin:content",
    tone: "blue",
    group: "Content",
    groupDescription: "Create, import, publish, and maintain problem sets.",
  },
  {
    href: "/admin/students",
    label: "Students",
    description: "Review student progress, attempts, and performance evidence.",
    icon: "Users",
    permission: "admin:users",
    tone: "green",
    group: "People & classes",
    groupDescription: "Manage rosters, assignments, and classroom activity.",
  },
  {
    href: "/classes",
    label: "Classes",
    description: "Manage classes, assignments, members, and announcements.",
    icon: "GraduationCap",
    permission: "admin:users",
    tone: "yellow",
    group: "People & classes",
    groupDescription: "Manage rosters, assignments, and classroom activity.",
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "Explore accuracy, mastery, trends, and set performance.",
    icon: "BarChart3",
    permission: "admin:analytics",
    tone: "blue",
    group: "Insights & operations",
    groupDescription: "Measure performance and keep the platform healthy.",
  },
  {
    href: "/admin/feedback",
    label: "Feedback queue",
    description: "Review and resolve reports submitted by students.",
    icon: "MessageSquareWarning",
    permission: "admin:feedback",
    tone: "pink",
    group: "Insights & operations",
    groupDescription: "Measure performance and keep the platform healthy.",
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    description: "Inspect important administrative changes and actions.",
    icon: "CheckCircle2",
    permission: "admin:audit",
    tone: "green",
    group: "Insights & operations",
    groupDescription: "Measure performance and keep the platform healthy.",
  },
];

export function availableAdminTools(role: UserRole) {
  return ADMIN_TOOL_DEFINITIONS.filter((tool) => hasPermission(role, tool.permission));
}
