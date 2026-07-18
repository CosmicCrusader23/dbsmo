import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit";
import { readJsonBody } from "@/lib/http-body";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_ROLE_UPDATE_BODY_BYTES = 2_048;

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasPermission(session.user.role, "admin:roles")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await readJsonBody(request, { maxBytes: MAX_ROLE_UPDATE_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === "too_large" ? "Request is too large." : "Invalid JSON." },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  const role =
    typeof body.value === "object" && body.value !== null && "role" in body.value
      ? (body.value as { role?: unknown }).role
      : undefined;

  const validRoles = ["STUDENT", "TEACHER", "CONTENT_EDITOR", "ANALYST", "ADMIN"];
  if (typeof role !== "string" || !validRoles.includes(role)) {
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

  const mutation = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('dbsmo-role-update'))`;

    const actor = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (!actor || !hasPermission(actor.role, "admin:roles")) {
      return { kind: "forbidden" as const };
    }

    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!target) return { kind: "not-found" as const };

    const user = await tx.user.update({
      where: { id: target.id },
      data: { role: role as UserRole },
      select: { id: true, role: true, email: true },
    });
    return { kind: "updated" as const, user };
  });

  if (mutation.kind === "forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (mutation.kind === "not-found") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const { user } = mutation;

  await recordAuditLog({
    actorId: session.user.id,
    action: "user.role_update",
    targetType: "User",
    targetId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return NextResponse.json({ ok: true, user });
}
