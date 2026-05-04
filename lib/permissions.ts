import type { UserRole } from "@prisma/client";

export type Permission =
  | "admin:analytics"
  | "admin:content"
  | "admin:export"
  | "admin:feedback"
  | "admin:users";

const ADMIN_PERMISSIONS: Permission[] = [
  "admin:analytics",
  "admin:content",
  "admin:export",
  "admin:feedback",
  "admin:users",
];

export function permissionsForRole(role: UserRole): Permission[] {
  return role === "ADMIN" ? ADMIN_PERMISSIONS : [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}
