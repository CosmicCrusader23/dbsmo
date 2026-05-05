import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasPermission(session.user.role, "admin:roles")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  const role = body?.role;

  const validRoles = ["STUDENT", "TEACHER", "CONTENT_EDITOR", "ANALYST", "ADMIN"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json(
      { error: `Role must be one of ${validRoles.join(", ")}.` },
      { status: 422 },
    );
  }

  if (id === session.user.id && role !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot demote your own admin account." },
      { status: 422 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: role as UserRole },
    select: { id: true, role: true, email: true },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "user.role_update",
    targetType: "User",
    targetId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return NextResponse.json({ ok: true, user });
}
