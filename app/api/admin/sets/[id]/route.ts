import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import {
  storeUploadedPdf,
  UploadedPdfValidationError,
  type UploadedPdfPayload,
} from "@/lib/uploaded-pdf";
import { recordAuditLog } from "@/lib/audit";
import {
  assertUniqueProblemNumbers,
  MAX_AUTHORING_BODY_BYTES,
  normalizeAuthoringProblem,
  patchProblemSetAuthoringSchema,
} from "@/lib/problem-set-authoring";
import { hasPermission } from "@/lib/permissions";
import { decodeUploadedImageAssets } from "@/lib/import/image-assets";
import {
  applyStagedProblemSetImageAssets,
  discardProblemSetImageStorageKeys,
  discardStagedProblemSetImageAssets,
  stageProblemSetImageAssets,
} from "@/lib/import/persist-image-assets";
import { cleanupUnreferencedImportedFiles } from "@/lib/imported-file-cleanup";
import { readJsonBody } from "@/lib/http-body";
import { lockProblemSet } from "@/lib/problem-set-locks";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

class ProblemSetMutationNotFoundError extends Error {}

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
    select: { id: true, slug: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_AUTHORING_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === "too_large" ? "Request body is too large." : "Invalid JSON." },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }

  const result = patchProblemSetAuthoringSchema.safeParse(body.value);
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
      if (!(error instanceof UploadedPdfValidationError)) {
        console.error("Failed to store replacement problem PDF:", error);
        return NextResponse.json({ error: "Could not store PDF upload." }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  let stagedImages;
  try {
    stagedImages = await stageProblemSetImageAssets({
      slug: existing.slug,
      assets: decodedImages.decoded,
    });
  } catch (error) {
    if (uploadedPdfId) {
      await cleanupUnreferencedImportedFiles([uploadedPdfId]).catch(() => undefined);
    }
    console.error("Failed to stage problem-set images:", error);
    return NextResponse.json({ error: "Could not store image uploads." }, { status: 500 });
  }

  let mutation;
  try {
    mutation = await prisma.$transaction(async (tx) => {
      if (!(await lockProblemSet(tx, id))) {
        throw new ProblemSetMutationNotFoundError();
      }
      const current = await tx.problemSet.findUniqueOrThrow({
        where: { id },
        select: { problemFileId: true, slug: true, status: true },
      });
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

      const appliedImages = await applyStagedProblemSetImageAssets({
        tx,
        problemSetId: id,
        uploadedById: session.user.id,
        staged: stagedImages,
      });

      return {
        appliedImages,
        previousProblemFileId: current.problemFileId,
        previousSlug: current.slug,
        previousStatus: current.status,
        updatedSet,
      };
    });
  } catch (error) {
    await discardStagedProblemSetImageAssets(stagedImages);
    if (uploadedPdfId) {
      await cleanupUnreferencedImportedFiles([uploadedPdfId]).catch((cleanupError) => {
        console.error("Failed to clean up rolled-back problem PDF:", cleanupError);
      });
    }
    if (error instanceof ProblemSetMutationNotFoundError) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    throw error;
  }

  await discardProblemSetImageStorageKeys(mutation.appliedImages.unusedStorageKeys);
  await cleanupUnreferencedImportedFiles(mutation.appliedImages.replacedFileIds).catch((error) => {
    console.error(`Failed to clean up replaced image assets for ${id}:`, error);
  });

  if (
    uploadedPdfId &&
    mutation.previousProblemFileId &&
    uploadedPdfId !== mutation.previousProblemFileId
  ) {
    await cleanupUnreferencedImportedFiles([mutation.previousProblemFileId]).catch((error) => {
      console.error("Failed to clean up replaced problem PDF:", error);
    });
  }

  await recordAuditLog({
    actorId: session.user.id,
    action:
      mutation.previousStatus !== mutation.updatedSet.status
        ? "problem_set.publish_state"
        : "problem_set.update",
    targetType: "ProblemSet",
    targetId: mutation.updatedSet.id,
    metadata: {
      slug: mutation.previousSlug,
      fromStatus: mutation.previousStatus,
      toStatus: mutation.updatedSet.status,
    },
  });

  return NextResponse.json(mutation.updatedSet);
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

  const deletion = await prisma.$transaction(async (tx) => {
    if (!(await lockProblemSet(tx, id))) return { kind: "not_found" as const };

    const existing = await tx.problemSet.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        problemFileId: true,
        solutionFileId: true,
        assets: { select: { fileId: true } },
        writeups: { select: { images: { select: { fileId: true } } } },
      },
    });

    if (existing.status !== "DRAFT" && existing.status !== "PUBLISHED") {
      return { kind: "conflict" as const };
    }

    await tx.problemSet.delete({ where: { id } });
    return { kind: "deleted" as const, existing };
  });

  if (deletion.kind === "not_found") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (deletion.kind === "conflict") {
    return NextResponse.json(
      { error: "Only draft or published sets can be deleted." },
      { status: 409 },
    );
  }

  const removedFileIds = [
    deletion.existing.problemFileId,
    deletion.existing.solutionFileId,
    ...deletion.existing.assets.map((asset) => asset.fileId),
    ...deletion.existing.writeups.flatMap((writeup) => writeup.images.map((image) => image.fileId)),
  ];
  await cleanupUnreferencedImportedFiles(removedFileIds).catch((error) => {
    console.error(`Failed to clean up files for deleted problem set ${id}:`, error);
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "problem_set.delete",
    targetType: "ProblemSet",
    targetId: deletion.existing.id,
    metadata: { title: deletion.existing.title, status: deletion.existing.status },
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      id: deletion.existing.id,
      title: deletion.existing.title,
      status: deletion.existing.status,
    },
  });
}
