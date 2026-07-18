import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const [tagRows, practiceScore] = await Promise.all([
    prisma.$queryRaw<Array<{ tag: string }>>`
      SELECT lower(trim(tag_value)) AS "tag"
      FROM "Problem" AS problem
      JOIN "ProblemSet" AS problem_set
        ON problem_set."id" = problem."problemSetId"
      CROSS JOIN LATERAL unnest(problem."topicTags") AS tags(tag_value)
      WHERE problem_set."status" = 'PUBLISHED'
        AND (problem_set."visibleFrom" IS NULL OR problem_set."visibleFrom" <= ${now})
        AND (problem_set."visibleTo" IS NULL OR problem_set."visibleTo" >= ${now})
        AND trim(tag_value) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM "PracticeSolve" AS solve
          WHERE solve."problemId" = problem."id"
            AND solve."userId" = ${session.user.id}
        )
      GROUP BY lower(trim(tag_value))
      HAVING COUNT(*) > 10
      ORDER BY lower(trim(tag_value))
      LIMIT 500
    `,
    prisma.practiceSolve.count({
      where: { userId: session.user.id },
    }),
  ]);

  return NextResponse.json({ tags: ["Endless", ...tagRows.map(({ tag }) => tag)], practiceScore });
}
