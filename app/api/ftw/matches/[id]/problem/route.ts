import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FTW_PROBLEM_LIMIT_SEC } from "@/lib/ftw";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const match = await prisma.ftwMatch.findUnique({
    where: { id },
    include: {
      answers: {
        orderBy: { problemIndex: "asc" },
        include: { problem: { select: { id: true, statement: true, contentFormat: true } } },
      },
    },
  });

  if (!match || match.userId !== session.user.id) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  if (match.status !== "IN_PROGRESS") {
    return NextResponse.json({
      done: true,
      match: {
        id: match.id,
        status: match.status,
        totalProblems: match.totalProblems,
        problemsServed: match.problemsServed,
        totalScore: match.totalScore,
        maxScore: match.maxScore,
        completedAt: match.completedAt,
      },
    });
  }

  const open = match.answers.find((a) => a.submittedAt === null);
  if (open) {
    const elapsedMs = Date.now() - open.servedAt.getTime();
    if (elapsedMs >= FTW_PROBLEM_LIMIT_SEC * 1000) {
      await prisma.ftwAnswer.update({
        where: { id: open.id },
        data: {
          submittedAt: new Date(),
          rawAnswer: null,
          isCorrect: false,
          elapsedMs: FTW_PROBLEM_LIMIT_SEC * 1000,
          points: 0,
        },
      });
      return NextResponse.json({
        timedOut: true,
        problemIndex: open.problemIndex,
        nextIndex: open.problemIndex + 1,
      });
    }

    return NextResponse.json({
      problem: {
        id: open.problem.id,
        statement: open.problem.statement,
        contentFormat: open.problem.contentFormat,
      },
      problemIndex: open.problemIndex,
      totalProblems: match.totalProblems,
      servedAt: open.servedAt,
      limitSeconds: FTW_PROBLEM_LIMIT_SEC,
      remainingMs: Math.max(0, FTW_PROBLEM_LIMIT_SEC * 1000 - elapsedMs),
      score: match.totalScore,
    });
  }

  if (match.problemsServed >= match.totalProblems) {
    const completed = await prisma.ftwMatch.update({
      where: { id: match.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return NextResponse.json({
      done: true,
      match: {
        id: completed.id,
        status: completed.status,
        totalProblems: completed.totalProblems,
        problemsServed: completed.problemsServed,
        totalScore: completed.totalScore,
        maxScore: completed.maxScore,
        completedAt: completed.completedAt,
      },
    });
  }

  const usedProblemIds = match.answers.map((a) => a.problemId);
  const now = new Date();
  const candidates = await prisma.problem.findMany({
    where: {
      id: { notIn: usedProblemIds },
      problemSet: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
          { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
        ],
      },
      ...(match.tag ? { topicTags: { has: match.tag } } : {}),
    },
    select: { id: true, statement: true, contentFormat: true },
  });

  if (candidates.length === 0) {
    await prisma.ftwMatch.update({
      where: { id: match.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return NextResponse.json({
      done: true,
      match: {
        id: match.id,
        status: "COMPLETED",
        totalProblems: match.totalProblems,
        problemsServed: match.problemsServed,
        totalScore: match.totalScore,
        maxScore: match.maxScore,
      },
    });
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const nextIndex = match.problemsServed;

  const served = new Date();
  await prisma.$transaction([
    prisma.ftwAnswer.create({
      data: {
        matchId: match.id,
        problemId: picked.id,
        problemIndex: nextIndex,
        servedAt: served,
      },
    }),
    prisma.ftwMatch.update({
      where: { id: match.id },
      data: { problemsServed: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({
    problem: { id: picked.id, statement: picked.statement, contentFormat: picked.contentFormat },
    problemIndex: nextIndex,
    totalProblems: match.totalProblems,
    servedAt: served,
    limitSeconds: FTW_PROBLEM_LIMIT_SEC,
    remainingMs: FTW_PROBLEM_LIMIT_SEC * 1000,
    score: match.totalScore,
  });
}
