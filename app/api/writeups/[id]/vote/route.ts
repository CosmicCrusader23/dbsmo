import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeVote(value: unknown) {
  if (value === 1 || value === "1") return 1;
  if (value === -1 || value === "-1") return -1;
  if (value === 0 || value === "0" || value === null) return 0;
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const [currentUser, writeup] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.writeup.findUnique({
      where: { id },
      include: {
        problemSet: true,
        votes: { select: { value: true } },
      },
    }),
  ]);

  if (!currentUser || !writeup) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(writeup.problemSet)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
  const value = normalizeVote(body?.value);
  if (value === null) {
    return NextResponse.json({ error: "Vote must be -1, 0, or 1." }, { status: 400 });
  }

  if (value === 0) {
    await prisma.writeupVote.deleteMany({ where: { writeupId: id, userId: currentUser.id } });
  } else {
    await prisma.writeupVote.upsert({
      where: {
        writeupId_userId: {
          writeupId: id,
          userId: currentUser.id,
        },
      },
      update: { value },
      create: {
        writeupId: id,
        userId: currentUser.id,
        value,
      },
    });
  }

  const votes = await prisma.writeupVote.findMany({
    where: { writeupId: id },
    select: { value: true, userId: true },
  });

  return NextResponse.json({
    ok: true,
    score: votes.reduce((sum, vote) => sum + vote.value, 0),
    myVote: votes.find((vote) => vote.userId === currentUser.id)?.value ?? 0,
  });
}
