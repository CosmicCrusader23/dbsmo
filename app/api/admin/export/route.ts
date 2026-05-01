import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { toCsvRow, computeBestAverageScore } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "attempts";

  if (type === "students") {
    return exportStudents();
  }
  return exportAttempts();
}

async function exportStudents() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      attempts: { select: { score: true, maxScore: true, problemSetId: true } },
    },
    orderBy: { name: "asc" },
  });

  const header = toCsvRow([
    "Name",
    "Email",
    "Group",
    "Sets Attempted",
    "Average Score %",
    "Total Attempts",
  ]);
  const rows = students.map((s) => {
    const sets = new Set(s.attempts.map((a) => a.problemSetId));
    const avg = computeBestAverageScore(s.attempts);
    return toCsvRow([
      s.name ?? "",
      s.email,
      s.group ?? "",
      String(sets.size),
      String(avg),
      String(s.attempts.length),
    ]);
  });

  const csv = [header, ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="students.csv"',
    },
  });
}

async function exportAttempts() {
  const attempts = await prisma.attempt.findMany({
    include: {
      user: { select: { name: true, email: true } },
      problemSet: { select: { title: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const header = toCsvRow([
    "Student",
    "Email",
    "Problem Set",
    "Attempt #",
    "Score",
    "Max Score",
    "Percentage",
    "Date",
  ]);
  const rows = attempts.map((a) =>
    toCsvRow([
      a.user.name ?? "",
      a.user.email,
      a.problemSet.title,
      String(a.attemptNumber),
      String(a.score),
      String(a.maxScore),
      String(a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0),
      a.submittedAt.toISOString(),
    ]),
  );

  const csv = [header, ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attempts.csv"',
    },
  });
}
