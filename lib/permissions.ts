import type { UserRole } from "@prisma/client";

export type Permission =
  | "admin:analytics"
  | "admin:audit"
  | "admin:content"
  | "admin:export"
  | "admin:feedback"
  | "admin:roles"
  | "admin:users"
  | "admin:view";

const ADMIN_PERMISSIONS: Permission[] = [
  "admin:analytics",
  "admin:audit",
  "admin:content",
  "admin:export",
  "admin:feedback",
  "admin:roles",
  "admin:users",
  "admin:view",
];

const TEACHER_PERMISSIONS: Permission[] = [
  "admin:analytics",
  "admin:content",
  "admin:export",
  "admin:feedback",
  "admin:users",
  "admin:view",
];

const CONTENT_EDITOR_PERMISSIONS: Permission[] = ["admin:content", "admin:view"];

const ANALYST_PERMISSIONS: Permission[] = ["admin:analytics", "admin:export", "admin:view"];

export function permissionsForRole(role: UserRole): Permission[] {
  if (role === "ADMIN") return ADMIN_PERMISSIONS;
  if (role === "TEACHER") return TEACHER_PERMISSIONS;
  if (role === "CONTENT_EDITOR") return CONTENT_EDITOR_PERMISSIONS;
  if (role === "ANALYST") return ANALYST_PERMISSIONS;
  return [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function isStaffRole(role: UserRole): boolean {
  return hasPermission(role, "admin:view");
}
