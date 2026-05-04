import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { AnswerType, ProblemSetStatus } from "@prisma/client";
import { normalizeTagList } from "@/lib/problem-tags";
import {
  isSupportedProblemContentFormat,
  normalizeProblemContentFormat,
} from "@/lib/problem-content-format";
import { storeUploadedPdf, type UploadedPdfPayload } from "@/lib/uploaded-pdf";

const PROBLEM_SET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createProblemSchema = z.object({
  number: z.coerce.number().int().positive(),
  statement: z.string().optional().default(""),
  contentFormat: z
    .string()
    .optional()
    .refine((value) => value === undefined || isSupportedProblemContentFormat(value), {
      message: "Invalid statement format.",
    }),
  answerKey: z.string().trim().min(1),
  answerType: z.nativeEnum(AnswerType),
  topicTags: z.array(z.string()).optional().default([]),
  points: z.coerce.number().int().positive().optional().default(1),
  explanationNote: z.string().nullable().optional(),
});

const createSetSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(PROBLEM_SET_SLUG_PATTERN, {
    message: "Slug must use lowercase letters, numbers, and single hyphens.",
  }),
  description: z.string().optional().default(""),
  order: z.coerce.number().int().positive().optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional().default(1),
  status: z.nativeEnum(ProblemSetStatus).optional().default("DRAFT"),
  topicTags: z.array(z.string()).optional().default([]),
  videoUrl: z.string().url().nullable().optional(),
  problemPdf: z
    .object({
      name: z.string().min(1),
      dataUrl: z.string().min(1),
    })
    .nullable()
    .optional(),
  problems: z.array(createProblemSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const parsed = createSetSchema.safeParse(body);
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

    const duplicateNumber = problems
      .map((problem) => problem.number)
      .find((number, index, numbers) => numbers.indexOf(number) !== index);
    if (duplicateNumber) {
      return NextResponse.json(
        { error: `Problem number ${duplicateNumber} is duplicated.` },
        { status: 422 },
      );
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
          create: problems.map(
            (p: {
              number: number;
              answerKey: string;
              answerType: AnswerType;
              statement?: string;
              topicTags?: string[];
              points?: number;
              explanationNote?: string | null;
              contentFormat?: string;
            }) => {
              const parts = p.answerKey
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean);
              return {
                number: p.number,
                statement: p.statement?.trim() || "",
                contentFormat: normalizeProblemContentFormat(p.contentFormat),
                answerKey: parts[0] || p.answerKey.trim(),
                acceptedAnswers: parts.slice(1),
                answerType: p.answerType,
                topicTags: normalizeTagList(p.topicTags || []),
                points: p.points || 1,
                explanationNote: p.explanationNote || null,
              };
            },
          ),
        },
      },
      include: { problems: true },
    });

    return NextResponse.json({ ok: true, problemSet });
  } catch (error) {
    console.error("Failed to create problem set:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
