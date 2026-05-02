import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { type AnswerType, gradeAnswer } from "@/lib/grading";

export const runtime = "nodejs";

const submitSchema = z.object({
  problemId: z.string().min(1),
  answer: z.string(),
});

const PRACTICE_ANSWER_TYPE_MAP = {
  EXACT: "exact",
  INTEGER: "integer",
  DECIMAL: "decimal",
  FRACTION: "fraction",
  SET: "set",
  MULTIPLE: "multiple",
  EXPRESSION: "expression",
} as const satisfies Record<string, AnswerType>;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const result = submitSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed." }, { status: 422 });
  }

  const { problemId, answer } = result.data;

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
  });

  if (!problem) {
    return NextResponse.json({ error: "Problem not found." }, { status: 404 });
  }

  const { isCorrect } = gradeAnswer({
    rawAnswer: answer,
    answerType: PRACTICE_ANSWER_TYPE_MAP[problem.answerType],
    answerKey: problem.answerKey,
    acceptedAnswers: problem.acceptedAnswers,
    caseSensitive: problem.caseSensitive,
  });

  let counted = false;

  if (isCorrect) {
    try {
      await prisma.practiceSolve.create({
        data: {
          userId: session.user.id,
          problemId: problem.id,
        },
      });
      counted = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        console.error("Failed to record practice solve:", error);
      }
    }
  }

  const practiceScore = isCorrect
    ? await prisma.practiceSolve.count({
        where: { userId: session.user.id },
      })
    : undefined;

  return NextResponse.json({ isCorrect, counted, practiceScore });
}
