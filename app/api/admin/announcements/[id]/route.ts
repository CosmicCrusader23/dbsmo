import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }

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

  const deleted = await prisma.announcement.deleteMany({
    where: {
      id,
      ...(currentUser.role === "ADMIN" ? {} : { createdById: currentUser.id }),
    },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
