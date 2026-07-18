import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FTW_PROBLEM_LIMIT_SEC } from "@/lib/ftw";
import { lockFtwMatch } from "@/lib/ftw-locks";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;
  const result = await prisma.$transaction(
    async (tx): Promise<{ status: number; body: unknown }> => {
      if (!(await lockFtwMatch(tx, id, userId))) {
        return { status: 404, body: { error: "Match not found." } };
      }

      const match = await tx.ftwMatch.findUnique({
        where: { id },
        include: {
          answers: {
            orderBy: { problemIndex: "asc" },
            include: {
              problem: { select: { id: true, statement: true, contentFormat: true } },
            },
          },
        },
      });

      if (!match || match.userId !== userId) {
        return { status: 404, body: { error: "Match not found." } };
      }

      if (match.status !== "IN_PROGRESS") {
        return {
          status: 200,
          body: {
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
          },
        };
      }

      const open = match.answers.find((answer) => answer.submittedAt === null);
      if (open) {
        const elapsedMs = Date.now() - open.servedAt.getTime();
        if (elapsedMs >= FTW_PROBLEM_LIMIT_SEC * 1000) {
          const claim = await tx.ftwAnswer.updateMany({
            where: { id: open.id, submittedAt: null },
            data: {
              submittedAt: new Date(),
              rawAnswer: null,
              isCorrect: false,
              elapsedMs: FTW_PROBLEM_LIMIT_SEC * 1000,
              points: 0,
            },
          });
          if (claim.count !== 1) {
            return { status: 409, body: { error: "Already submitted." } };
          }
          return {
            status: 200,
            body: {
              timedOut: true,
              problemIndex: open.problemIndex,
              nextIndex: open.problemIndex + 1,
            },
          };
        }

        return {
          status: 200,
          body: {
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
          },
        };
      }

      if (match.problemsServed >= match.totalProblems) {
        const completed = await tx.ftwMatch.update({
          where: { id: match.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        return {
          status: 200,
          body: {
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
          },
        };
      }

      const usedProblemIds = match.answers.map((answer) => answer.problemId);
      const now = new Date();
      const candidateWhere = {
        id: { notIn: usedProblemIds },
        problemSet: {
          status: "PUBLISHED" as const,
          AND: [
            { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
            { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
          ],
        },
        ...(match.tag ? { topicTags: { has: match.tag } } : {}),
      };
      const candidateCount = await tx.problem.count({ where: candidateWhere });

      if (candidateCount === 0) {
        await tx.ftwMatch.update({
          where: { id: match.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        return {
          status: 200,
          body: {
            done: true,
            match: {
              id: match.id,
              status: "COMPLETED",
              totalProblems: match.totalProblems,
              problemsServed: match.problemsServed,
              totalScore: match.totalScore,
              maxScore: match.maxScore,
            },
          },
        };
      }

      const problemSelect = { id: true, statement: true, contentFormat: true } as const;
      const picked =
        (await tx.problem.findFirst({
          where: candidateWhere,
          orderBy: { id: "asc" },
          skip: Math.floor(Math.random() * candidateCount),
          select: problemSelect,
        })) ??
        (await tx.problem.findFirst({
          where: candidateWhere,
          orderBy: { id: "asc" },
          select: problemSelect,
        }));
      if (!picked) {
        await tx.ftwMatch.update({
          where: { id: match.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        return {
          status: 200,
          body: {
            done: true,
            match: {
              id: match.id,
              status: "COMPLETED",
              totalProblems: match.totalProblems,
              problemsServed: match.problemsServed,
              totalScore: match.totalScore,
              maxScore: match.maxScore,
            },
          },
        };
      }
      const nextIndex = match.problemsServed;
      const servedAt = new Date();
      await tx.ftwAnswer.create({
        data: {
          matchId: match.id,
          problemId: picked.id,
          problemIndex: nextIndex,
          servedAt,
        },
      });
      await tx.ftwMatch.update({
        where: { id: match.id },
        data: { problemsServed: { increment: 1 } },
      });

      return {
        status: 200,
        body: {
          problem: {
            id: picked.id,
            statement: picked.statement,
            contentFormat: picked.contentFormat,
          },
          problemIndex: nextIndex,
          totalProblems: match.totalProblems,
          servedAt,
          limitSeconds: FTW_PROBLEM_LIMIT_SEC,
          remainingMs: FTW_PROBLEM_LIMIT_SEC * 1000,
          score: match.totalScore,
        },
      };
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
