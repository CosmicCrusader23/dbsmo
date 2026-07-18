import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { type AnswerType, gradeAnswer } from "@/lib/grading";
import { isVisibleToStudent } from "@/lib/visibility";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { readJsonBody } from "@/lib/http-body";
import {
  MAX_PRACTICE_SUBMISSION_BODY_BYTES,
  practiceSubmissionSchema,
} from "@/lib/practice-policy";

export const runtime = "nodejs";

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

  const body = await readJsonBody(request, { maxBytes: MAX_PRACTICE_SUBMISSION_BODY_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Submission payload is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = practiceSubmissionSchema.safeParse(body.value);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed." }, { status: 422 });
  }

  const { problemId, answer } = result.data;

  const [currentUser, problem] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    }),
    prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        problemSet: {
          select: {
            status: true,
            visibleFrom: true,
            visibleTo: true,
          },
        },
      },
    }),
  ]);

  if (!currentUser) {
    return NextResponse.json({ error: "User record not found." }, { status: 401 });
  }

  if (!problem) {
    return NextResponse.json({ error: "Problem not found." }, { status: 404 });
  }

  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(problem.problemSet)) {
    return NextResponse.json({ error: "Problem is not available." }, { status: 403 });
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
      if (!isPrismaUniqueViolation(error)) {
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
