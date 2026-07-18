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

  type AssignmentRow = {
    assignmentId: string;
    classId: string;
    className: string;
    problemSetId: string;
    problemSetSlug: string;
    problemSetTitle: string;
    totalProblems: number;
    dueAt: Date | null;
    createdAt: Date;
    completedAt: Date | null;
  };

  const rows = await prisma.$queryRaw<AssignmentRow[]>`
    WITH assignment_rows AS (
      SELECT
      a."id" AS "assignmentId",
      cls."id" AS "classId",
      cls."name" AS "className",
      ps."id" AS "problemSetId",
      ps."slug" AS "problemSetSlug",
      ps."title" AS "problemSetTitle",
      (
        SELECT COUNT(*)::int
        FROM "Problem" AS problem
        WHERE problem."problemSetId" = ps."id"
      ) AS "totalProblems",
      a."dueAt" AS "dueAt",
      a."createdAt" AS "createdAt",
      (
        SELECT MIN(attempt."submittedAt")
        FROM "Attempt" AS attempt
        WHERE attempt."userId" = ${session.user.id}
          AND attempt."problemSetId" = a."problemSetId"
          AND attempt."submittedAt" > a."createdAt"
      ) AS "completedAt"
      FROM "Assignment" AS a
      JOIN "Class" AS cls ON cls."id" = a."classId"
      JOIN "ClassMember" AS membership ON membership."classId" = cls."id"
      JOIN "ProblemSet" AS ps ON ps."id" = a."problemSetId"
      WHERE membership."studentId" = ${session.user.id}
    )
    SELECT *
    FROM assignment_rows
    ORDER BY
      ("completedAt" IS NOT NULL) ASC,
      "dueAt" ASC NULLS LAST,
      "createdAt" DESC
    LIMIT 501
  `;
  const truncated = rows.length > 500;
  const assignments = rows.slice(0, 500).map((row) => ({
    assignmentId: row.assignmentId,
    classId: row.classId,
    className: row.className,
    problemSet: {
      id: row.problemSetId,
      slug: row.problemSetSlug,
      title: row.problemSetTitle,
      totalProblems: row.totalProblems,
    },
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }));

  return NextResponse.json({ assignments, truncated });
}
