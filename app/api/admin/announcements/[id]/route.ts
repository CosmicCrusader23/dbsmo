import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!currentUser || !hasPermission(currentUser.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });
  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  if (currentUser.role !== "ADMIN" && announcement.createdById !== currentUser.id) {
    return NextResponse.json(
      { error: "Only the author can delete this announcement." },
      { status: 403 },
    );
  }

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
