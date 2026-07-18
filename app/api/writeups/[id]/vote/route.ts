import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/http-body";
import { isVisibleToStudent } from "@/lib/visibility";
import { MAX_WRITEUP_VOTE_BODY_BYTES, writeupVoteSchema } from "@/lib/writeup-vote-policy";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
      },
    }),
  ]);

  if (!currentUser || !writeup) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(writeup.problemSet)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_WRITEUP_VOTE_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === "too_large" ? "Request is too large." : "Invalid JSON." },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  const parsed = writeupVoteSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Vote must be -1, 0, or 1." }, { status: 400 });
  }
  const value = parsed.data;

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

  const [score, myVote] = await Promise.all([
    prisma.writeupVote.aggregate({
      where: { writeupId: id },
      _sum: { value: true },
    }),
    prisma.writeupVote.findUnique({
      where: {
        writeupId_userId: {
          writeupId: id,
          userId: currentUser.id,
        },
      },
      select: { value: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    score: score._sum.value ?? 0,
    myVote: myVote?.value ?? 0,
  });
}
