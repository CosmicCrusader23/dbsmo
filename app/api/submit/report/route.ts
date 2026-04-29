import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FeedbackType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { problemSetId, problemNumber, type, message } = body;

    if (!problemSetId || !type || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Object.values(FeedbackType).includes(type)) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }

    let problemId = null;
    if (problemNumber) {
      const problem = await prisma.problem.findUnique({
        where: { problemSetId_number: { problemSetId, number: Number(problemNumber) } },
      });
      if (problem) {
        problemId = problem.id;
      }
    }

    const report = await prisma.feedbackReport.create({
      data: {
        userId: session.user.id,
        problemSetId,
        problemId,
        type: type as FeedbackType,
        message,
      },
    });

    return NextResponse.json({ ok: true, reportId: report.id });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
