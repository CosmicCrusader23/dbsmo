import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (
    isCrossSiteBrowserRequest(request, {
      allowSameSiteWithMatchingOrigin: true,
      expectedOrigin: process.env.NEXTAUTH_URL,
    })
  ) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!actor || !hasPermission(actor.role, "admin:allowlist")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const entry = await prisma.authAllowlistEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Allowlist entry not found." }, { status: 404 });

  await prisma.authAllowlistEntry.delete({ where: { id } });
  await recordAuditLog({
    actorId: session.user.id,
    action: "auth.allowlist_remove",
    targetType: "AuthAllowlistEntry",
    targetId: entry.id,
    metadata: { kind: entry.kind, value: entry.value },
  });
  return NextResponse.json({ ok: true });
}
