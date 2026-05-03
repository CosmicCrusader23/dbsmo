import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  const role = body?.role;

  if (role !== "ADMIN" && role !== "STUDENT") {
    return NextResponse.json({ error: "Role must be ADMIN or STUDENT." }, { status: 422 });
  }

  if (id === session.user.id && role === "STUDENT") {
    return NextResponse.json(
      { error: "You cannot demote your own admin account." },
      { status: 422 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: role as UserRole },
    select: { id: true, role: true },
  });

  return NextResponse.json({ ok: true, user });
}
