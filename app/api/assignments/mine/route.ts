import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const memberships = await prisma.classMember.findMany({
    where: { studentId: session.user.id },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          assignments: {
            include: {
              problemSet: {
                select: { id: true, slug: true, title: true, _count: { select: { problems: true } } },
              },
            },
          },
        },
      },
    },
  });

  type Row = {
    assignmentId: string;
    classId: string;
    className: string;
    problemSet: { id: string; slug: string; title: string; totalProblems: number };
    dueAt: Date | null;
    createdAt: Date;
    completedAt: Date | null;
  };

  const rows: Row[] = [];
  const setIds = new Set<string>();
  for (const m of memberships) {
    for (const a of m.class.assignments) {
      setIds.add(a.problemSetId);
      rows.push({
        assignmentId: a.id,
        classId: m.class.id,
        className: m.class.name,
        problemSet: {
          id: a.problemSet.id,
          slug: a.problemSet.slug,
          title: a.problemSet.title,
          totalProblems: a.problemSet._count.problems,
        },
        dueAt: a.dueAt,
        createdAt: a.createdAt,
        completedAt: null,
      });
    }
  }

  if (rows.length > 0) {
    const attempts = await prisma.attempt.findMany({
      where: {
        userId: session.user.id,
        problemSetId: { in: Array.from(setIds) },
      },
      select: { problemSetId: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
    });
    for (const r of rows) {
      const earliest = attempts.find(
        (a) => a.problemSetId === r.problemSet.id && a.submittedAt > r.createdAt,
      );
      r.completedAt = earliest?.submittedAt ?? null;
    }
  }

  return NextResponse.json({ assignments: rows });
}
