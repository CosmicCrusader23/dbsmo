import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import { storeUploadedPdf, type UploadedPdfPayload } from "@/lib/uploaded-pdf";
import { recordAuditLog } from "@/lib/audit";
import {
  assertUniqueProblemNumbers,
  normalizeAuthoringProblem,
  patchProblemSetAuthoringSchema,
} from "@/lib/problem-set-authoring";
import { hasPermission } from "@/lib/permissions";
import { decodeUploadedImageAssets } from "@/lib/import/image-assets";
import { persistProblemSetImageAssets } from "@/lib/import/persist-image-assets";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;

  const set = await prisma.problemSet.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { number: "asc" } },
      problemFile: true,
      solutionFile: true,
    },
  });

  if (!set) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(set);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await prisma.problemSet.findUnique({
    where: { id },
    select: { id: true, status: true, slug: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = patchProblemSetAuthoringSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const { problems, problemPdf, imageAssets, ...setPatch } = result.data;
  const normalizedPatch = {
    ...setPatch,
    topicTags: setPatch.topicTags ? normalizeTagList(setPatch.topicTags) : undefined,
  };

  if (problems) {
    const duplicateNumberError = assertUniqueProblemNumbers(problems);
    if (duplicateNumberError) {
      return NextResponse.json({ error: duplicateNumberError }, { status: 422 });
    }

    const ids = problems.map((problem) => problem.id).filter(Boolean);
    const duplicateId = ids.find((problemId, index) => ids.indexOf(problemId) !== index);
    if (duplicateId) {
      return NextResponse.json(
        { error: "Problem update payload contains duplicate problem IDs." },
        { status: 422 },
      );
    }
  }

  const decodedImages = decodeUploadedImageAssets(imageAssets);
  if (!decodedImages.ok) {
    return NextResponse.json(
      { error: "Invalid image upload.", details: decodedImages.errors },
      { status: 400 },
    );
  }

  let uploadedPdfId: string | null | undefined;
  if (problemPdf) {
    try {
      const uploadedPdf = await storeUploadedPdf({
        payload: problemPdf as UploadedPdfPayload,
        prefix: `manual/${id}`,
        uploadedById: session.user.id,
      });
      uploadedPdfId = uploadedPdf.id;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid PDF upload." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSet = await tx.problemSet.update({
      where: { id },
      data: {
        ...normalizedPatch,
        problemFileId: uploadedPdfId,
      },
    });

    if (problems) {
      const existingProblems = await tx.problem.findMany({
        where: { problemSetId: id },
        select: { id: true },
      });
      const existingIds = new Set(existingProblems.map((problem) => problem.id));
      const providedExistingIds = new Set(
        problems
          .map((problem) => problem.id)
          .filter((problemId): problemId is string =>
            Boolean(problemId && existingIds.has(problemId)),
          ),
      );

      await tx.problem.deleteMany({
        where: {
          problemSetId: id,
          id: { notIn: Array.from(providedExistingIds) },
        },
      });

      for (const [index, problem] of problems.entries()) {
        const data = normalizeAuthoringProblem(problem, index);

        if (problem.id && existingIds.has(problem.id)) {
          await tx.problem.update({
            where: { id: problem.id },
            data,
          });
        } else {
          await tx.problem.create({
            data: {
              ...data,
              problemSetId: id,
            },
          });
        }
      }
    }

    return updatedSet;
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: existing.status !== updated.status ? "problem_set.publish_state" : "problem_set.update",
    targetType: "ProblemSet",
    targetId: updated.id,
    metadata: { slug: existing.slug, fromStatus: existing.status, toStatus: updated.status },
  });

  if (decodedImages.decoded.length > 0) {
    await persistProblemSetImageAssets({
      problemSetId: updated.id,
      slug: updated.slug,
      uploadedById: session.user.id,
      assets: decodedImages.decoded,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await prisma.problemSet.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (existing.status !== "DRAFT" && existing.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Only draft or published sets can be deleted." },
      { status: 409 },
    );
  }

  await prisma.problemSet.delete({
    where: { id },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "problem_set.delete",
    targetType: "ProblemSet",
    targetId: existing.id,
    metadata: { title: existing.title, status: existing.status },
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      id: existing.id,
      title: existing.title,
      status: existing.status,
    },
  });
}
