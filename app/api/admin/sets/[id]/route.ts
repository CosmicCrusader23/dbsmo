import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import { storeUploadedPdf, type UploadedPdfPayload } from "@/lib/uploaded-pdf";

export const runtime = "nodejs";

const answerTypeSchema = z.enum(["EXACT", "INTEGER", "DECIMAL", "FRACTION", "SET", "MULTIPLE"]);

const problemPatchSchema = z.object({
  id: z.string().min(1).optional(),
  number: z.number().int().positive().optional(),
  statement: z.string().optional(),
  answerKey: z.string().min(1),
  answerType: answerTypeSchema,
  topicTags: z.array(z.string().min(1)).optional(),
  points: z.number().int().positive().optional(),
  explanationNote: z.string().nullable().optional(),
});

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  order: z.number().int().positive().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  topicTags: z.array(z.string().min(1)).optional(),
  videoUrl: z.string().url().nullable().optional(),
  problemPdf: z
    .object({
      name: z.string().min(1),
      dataUrl: z.string().min(1),
    })
    .nullable()
    .optional(),
  problems: z.array(problemPatchSchema).min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
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
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await prisma.problemSet.findUnique({
    where: { id },
    select: { id: true },
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

  const result = patchSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const { problems, problemPdf, ...setPatch } = result.data;
  const normalizedPatch = {
    ...setPatch,
    topicTags: setPatch.topicTags ? normalizeTagList(setPatch.topicTags) : undefined,
  };

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

      const duplicateExistingIds = problems
        .map((problem) => problem.id)
        .filter((problemId): problemId is string => Boolean(problemId))
        .filter((problemId, index, ids) => ids.indexOf(problemId) !== index);

      if (duplicateExistingIds.length > 0) {
        throw new Error("Problem update payload contains duplicate problem IDs.");
      }

      await tx.problem.deleteMany({
        where: {
          problemSetId: id,
          id: { notIn: Array.from(providedExistingIds) },
        },
      });

      for (const [index, problem] of problems.entries()) {
        const data = {
          number: problem.number ?? index + 1,
          statement: problem.statement?.trim() ?? "",
          answerKey: problem.answerKey.trim(),
          answerType: problem.answerType,
          topicTags: normalizeTagList(problem.topicTags ?? []),
          points: problem.points ?? 1,
          explanationNote: problem.explanationNote?.trim() ?? null,
        };

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

  return NextResponse.json(updated);
}
