import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import { storeUploadedPdf, type UploadedPdfPayload } from "@/lib/uploaded-pdf";
import { recordAuditLog } from "@/lib/audit";
import {
  assertUniqueProblemNumbers,
  createProblemSetAuthoringSchema,
  normalizeAuthoringProblem,
} from "@/lib/problem-set-authoring";
import { hasPermission } from "@/lib/permissions";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "admin:content")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const parsed = createProblemSetAuthoringSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const {
      title,
      slug,
      description,
      order,
      difficulty,
      status,
      topicTags,
      videoUrl,
      problemPdf,
      problems,
    } = parsed.data;

    const duplicateNumberError = assertUniqueProblemNumbers(problems);
    if (duplicateNumberError) {
      return NextResponse.json({ error: duplicateNumberError }, { status: 422 });
    }

    const existing = await prisma.problemSet.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `A problem set with slug "${slug}" already exists.` },
        { status: 409 },
      );
    }

    let finalOrder = order;
    if (!finalOrder) {
      const maxOrderResult = await prisma.problemSet.aggregate({ _max: { order: true } });
      finalOrder = (maxOrderResult._max.order ?? 0) + 1;
    }

    let problemFileId: string | null = null;
    if (problemPdf) {
      try {
        const uploadedPdf = await storeUploadedPdf({
          payload: problemPdf as UploadedPdfPayload,
          prefix: `manual/${slug}`,
          uploadedById: session.user.id,
        });
        problemFileId = uploadedPdf.id;
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid PDF upload." },
          { status: 400 },
        );
      }
    }

    const problemSet = await prisma.problemSet.create({
      data: {
        title,
        slug,
        description: description || "",
        order: finalOrder,
        difficulty,
        status,
        topicTags: normalizeTagList(topicTags || []),
        allowedGroups: [],
        videoUrl: videoUrl || null,
        problemFileId,
        createdById: session.user.id,
        problems: {
          create: problems.map((problem, index) => normalizeAuthoringProblem(problem, index)),
        },
      },
      include: { problems: true },
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "problem_set.create",
      targetType: "ProblemSet",
      targetId: problemSet.id,
      metadata: { slug: problemSet.slug, status: problemSet.status },
    });

    return NextResponse.json({ ok: true, problemSet });
  } catch (error) {
    console.error("Failed to create problem set:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
