import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedSet(userId: string, setId: string) {
  const [user, problemSet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    }),
    prisma.problemSet.findUnique({
      where: { id: setId },
      select: {
        id: true,
        status: true,
        visibleFrom: true,
        visibleTo: true,
      },
    }),
  ]);

  if (!user || !problemSet) {
    return { error: "Not found.", status: 404 as const };
  }

  if (user.role !== "ADMIN" && !isVisibleToStudent(problemSet)) {
    return { error: "This set is not available to your account.", status: 403 as const };
  }

  return { user, problemSet };
}

export async function PUT(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const authorized = await getAuthorizedSet(session.user.id, id);
  if ("error" in authorized) {
    return NextResponse.json({ error: authorized.error }, { status: authorized.status });
  }

  await prisma.problemSetBookmark.upsert({
    where: {
      userId_problemSetId: {
        userId: session.user.id,
        problemSetId: id,
      },
    },
    update: {},
    create: {
      userId: session.user.id,
      problemSetId: id,
    },
  });

  return NextResponse.json({ ok: true, bookmarked: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const authorized = await getAuthorizedSet(session.user.id, id);
  if ("error" in authorized) {
    return NextResponse.json({ error: authorized.error }, { status: authorized.status });
  }

  await prisma.problemSetBookmark.deleteMany({
    where: {
      userId: session.user.id,
      problemSetId: id,
    },
  });

  return NextResponse.json({ ok: true, bookmarked: false });
}
