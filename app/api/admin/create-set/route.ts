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
import { nextProblemSetOrderFromDatabase } from "@/lib/problem-set-order";
import {
  assertUniqueProblemNumbers,
  createProblemSetAuthoringSchema,
  MAX_AUTHORING_BODY_BYTES,
  normalizeAuthoringProblem,
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
import { AsymptoteRenderError, renderEmbeddedAsymptoteStatements } from "@/lib/asymptote";
import { MAX_IMAGES_PER_SET, MAX_TOTAL_IMAGE_BYTES } from "@/lib/import/image-assets";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "admin:content")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await readJsonBody(req, { maxBytes: MAX_AUTHORING_BODY_BYTES });
    if (!body.ok) {
      return NextResponse.json(
        { error: body.reason === "too_large" ? "Request body is too large." : "Invalid JSON." },
        { status: body.reason === "too_large" ? 413 : 400 },
      );
    }

    const parsed = createProblemSetAuthoringSchema.safeParse(body.value);
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
      imageAssets,
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

    const decodedImages = decodeUploadedImageAssets(imageAssets);
    if (!decodedImages.ok) {
      return NextResponse.json(
        { error: "Invalid image upload.", details: decodedImages.errors },
        { status: 400 },
      );
    }

    let renderedStatements;
    try {
      renderedStatements = await renderEmbeddedAsymptoteStatements(
        problems.map((problem) => problem.statement),
      );
    } catch (error) {
      if (error instanceof AsymptoteRenderError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.code === "unavailable" ? 503 : error.code === "busy" ? 429 : 422 },
        );
      }
      throw error;
    }

    const uploadedKeys = new Set(decodedImages.decoded.map((asset) => asset.key));
    const generatedCollision = renderedStatements.assets.find((asset) =>
      uploadedKeys.has(asset.key),
    );
    if (generatedCollision) {
      return NextResponse.json(
        {
          error: `Image key "${generatedCollision.key}" is reserved for a generated Asymptote diagram.`,
        },
        { status: 422 },
      );
    }
    const allImages = [...decodedImages.decoded, ...renderedStatements.assets];
    if (
      allImages.length > MAX_IMAGES_PER_SET ||
      allImages.reduce((sum, asset) => sum + asset.sizeBytes, 0) > MAX_TOTAL_IMAGE_BYTES
    ) {
      return NextResponse.json(
        { error: "Uploaded and generated images exceed the problem-set asset limits." },
        { status: 422 },
      );
    }
    const preparedProblems = problems.map((problem, index) => ({
      ...problem,
      statement: renderedStatements.statements[index],
    }));

    let finalOrder = order ?? "";
    if (!finalOrder) {
      finalOrder = await nextProblemSetOrderFromDatabase();
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
        if (!(error instanceof UploadedPdfValidationError)) {
          console.error("Failed to store problem-set PDF:", error);
          return NextResponse.json({ error: "Could not store PDF upload." }, { status: 500 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    let stagedImages;
    try {
      stagedImages = await stageProblemSetImageAssets({
        slug,
        assets: allImages,
      });
    } catch (error) {
      if (problemFileId) {
        await cleanupUnreferencedImportedFiles([problemFileId]).catch(() => undefined);
      }
      throw error;
    }

    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const problemSet = await tx.problemSet.create({
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
              create: preparedProblems.map((problem, index) =>
                normalizeAuthoringProblem(problem, index),
              ),
            },
          },
          include: { problems: true },
        });
        const appliedImages = await applyStagedProblemSetImageAssets({
          tx,
          problemSetId: problemSet.id,
          uploadedById: session.user.id,
          staged: stagedImages,
        });
        return { appliedImages, problemSet };
      });
    } catch (error) {
      await discardStagedProblemSetImageAssets(stagedImages);
      if (problemFileId) {
        await cleanupUnreferencedImportedFiles([problemFileId]).catch((cleanupError) => {
          console.error("Failed to clean up PDF after problem-set creation failed:", cleanupError);
        });
      }
      throw error;
    }

    await discardProblemSetImageStorageKeys(created.appliedImages.unusedStorageKeys);
    if (created.appliedImages.replacedFileIds.length > 0) {
      await cleanupUnreferencedImportedFiles(created.appliedImages.replacedFileIds).catch(
        (cleanupError) => {
          console.error(
            "Failed to clean up replaced files after problem-set creation:",
            cleanupError,
          );
        },
      );
    }
    const { problemSet } = created;

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
