import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { isVisibleToStudent } from "@/lib/visibility";
import { feedbackSubmissionSchema, MAX_FEEDBACK_BODY_BYTES } from "@/lib/feedback";
import { readJsonBody } from "@/lib/http-body";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonBody(req, { maxBytes: MAX_FEEDBACK_BODY_BYTES });
    if (!body.ok) {
      if (body.reason === "too_large") {
        return NextResponse.json({ error: "Feedback is too large." }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    const parsed = feedbackSubmissionSchema.safeParse(body.value);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback." }, { status: 422 });
    }
    const { problemSetId, problemNumber, type, message } = parsed.data;

    const [currentUser, problemSet] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      }),
      prisma.problemSet.findUnique({
        where: { id: problemSetId },
        select: { id: true, status: true, visibleFrom: true, visibleTo: true },
      }),
    ]);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!problemSet) {
      return NextResponse.json({ error: "Problem set not found" }, { status: 404 });
    }
    if (currentUser.role !== "ADMIN" && !isVisibleToStudent(problemSet)) {
      return NextResponse.json({ error: "Problem set is not available" }, { status: 403 });
    }

    let problemId = null;
    if (problemNumber !== null) {
      const problem = await prisma.problem.findUnique({
        where: { problemSetId_number: { problemSetId, number: problemNumber } },
        select: { id: true },
      });
      if (!problem) {
        return NextResponse.json({ error: "Problem not found" }, { status: 404 });
      }
      problemId = problem.id;
    }

    const report = await prisma.feedbackReport.create({
      data: {
        userId: session.user.id,
        problemSetId,
        problemId,
        type,
        message,
      },
    });

    return NextResponse.json({ ok: true, reportId: report.id });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
