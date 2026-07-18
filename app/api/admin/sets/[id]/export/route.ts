import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { problemSetToImportJson } from "@/lib/import/problem-set-json-export";
import { MAX_JSON_BYTES } from "@/lib/import/json-import";
import { hasPermission } from "@/lib/permissions";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function exportFileName(slug: string) {
  return `${slug.replace(/[^a-z0-9-]+/gi, "-") || "problem-set"}.json`;
}

export async function GET(request: Request, context: RouteContext) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site export request rejected." }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:export")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const set = await prisma.problemSet.findUnique({
    where: { id },
    select: {
      slug: true,
      title: true,
      description: true,
      order: true,
      status: true,
      visibleFrom: true,
      visibleTo: true,
      topicTags: true,
      difficulty: true,
      videoUrl: true,
    },
  });

  if (!set) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [preflight] = await prisma.$queryRaw<
    Array<{ estimatedBytes: number; problemCount: number }>
  >`
    SELECT
      COUNT(*)::int AS "problemCount",
      COALESCE(
        SUM(
          octet_length(COALESCE("statement", '')) +
          octet_length(COALESCE("answerKey", '')) +
          octet_length(COALESCE("explanationNote", '')) +
          octet_length(COALESCE(array_to_string("acceptedAnswers", ''), '')) +
          octet_length(COALESCE(array_to_string("topicTags", ''), ''))
        ),
        0
      )::float8 AS "estimatedBytes"
    FROM "Problem"
    WHERE "problemSetId" = ${id}
  `;
  if ((preflight?.problemCount ?? 0) > 1_000 || (preflight?.estimatedBytes ?? 0) > MAX_JSON_BYTES) {
    return NextResponse.json(
      { error: "Problem set is too large for a bounded JSON export." },
      { status: 413 },
    );
  }

  const problems = await prisma.problem.findMany({
    where: { problemSetId: id },
    orderBy: { number: "asc" },
  });
  const json = JSON.stringify(problemSetToImportJson({ ...set, problems }));
  if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) {
    return NextResponse.json(
      { error: "Problem set is too large for a bounded JSON export." },
      { status: 413 },
    );
  }

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(set.slug)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
