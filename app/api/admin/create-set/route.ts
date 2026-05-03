import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { AnswerType, ProblemSetStatus } from "@prisma/client";
import { normalizeTagList } from "@/lib/problem-tags";
import {
  isSupportedProblemContentFormat,
  normalizeProblemContentFormat,
} from "@/lib/problem-content-format";
import { storeUploadedPdf, type UploadedPdfPayload } from "@/lib/uploaded-pdf";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
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
    } = body;

    if (!title || !slug || !problems || !Array.isArray(problems) || problems.length === 0) {
      return NextResponse.json(
        { error: "Title, slug, and at least one problem are required." },
        { status: 400 },
      );
    }

    // Check for slug collision
    const existing = await prisma.problemSet.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `A problem set with slug "${slug}" already exists.` },
        { status: 409 },
      );
    }

    // Validate answer types
    const validTypes = Object.values(AnswerType);
    for (const p of problems) {
      if (!validTypes.includes(p.answerType)) {
        return NextResponse.json(
          { error: `Invalid answer type "${p.answerType}" for problem ${p.number}.` },
          { status: 400 },
        );
      }
      if (!p.answerKey || p.answerKey.trim() === "") {
        return NextResponse.json(
          { error: `Problem ${p.number} is missing an answer.` },
          { status: 400 },
        );
      }
      if (p.contentFormat !== undefined && !isSupportedProblemContentFormat(p.contentFormat)) {
        return NextResponse.json(
          { error: `Invalid statement format "${p.contentFormat}" for problem ${p.number}.` },
          { status: 400 },
        );
      }
    }

    const validStatuses = Object.values(ProblemSetStatus);
    const finalStatus = validStatuses.includes(status) ? status : "DRAFT";

    let finalOrder = order;
    if (typeof order !== "number" || order <= 0) {
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
        difficulty: difficulty || 1,
        status: finalStatus,
        topicTags: normalizeTagList(topicTags || []),
        allowedGroups: [],
        videoUrl: videoUrl || null,
        problemFileId,
        createdById: session.user.id,
        problems: {
          create: problems.map(
            (p: {
              number: number;
              statement?: string;
              answerKey: string;
              answerType: AnswerType;
              topicTags?: string[];
              points?: number;
              explanationNote?: string;
              contentFormat?: string;
            }) => {
              const parts = p.answerKey.split(";").map((s) => s.trim()).filter(Boolean);
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
