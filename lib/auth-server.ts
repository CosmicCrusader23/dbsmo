import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { UserRole } from "@prisma/client";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Please log in");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== UserRole.ADMIN) {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export function getUserGroups(user: { group: string | null }) {
  return user.group ? [user.group] : [];
}
