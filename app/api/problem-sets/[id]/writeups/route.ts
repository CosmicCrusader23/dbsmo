import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ProblemContentFormat } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToStudent } from "@/lib/visibility";
import { storeWriteupImage } from "@/lib/writeup-images";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_WRITEUP_IMAGES = 4;
const MAX_WRITEUP_BODY_CHARS = 20000;
const MAX_WRITEUP_TITLE_CHARS = 120;

function normalizeContentFormat(value: FormDataEntryValue | null) {
  return value === "HTML" ? ProblemContentFormat.HTML : ProblemContentFormat.LATEX;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const [currentUser, problemSet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.problemSet.findUnique({ where: { id } }),
  ]);

  if (!currentUser || !problemSet) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(problemSet)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, MAX_WRITEUP_TITLE_CHARS);
  const body = String(formData.get("body") ?? "").trim();
  const contentFormat = normalizeContentFormat(formData.get("contentFormat"));
  const images = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (body.length > MAX_WRITEUP_BODY_CHARS) {
    return NextResponse.json({ error: "Writeup text is too long." }, { status: 400 });
  }
  if (!body && images.length === 0) {
    return NextResponse.json({ error: "Add LaTeX text or at least one image." }, { status: 400 });
  }
  if (images.length > MAX_WRITEUP_IMAGES) {
    return NextResponse.json(
      { error: `Upload at most ${MAX_WRITEUP_IMAGES} images.` },
      { status: 400 },
    );
  }

  const writeup = await prisma.writeup.create({
    data: {
      problemSetId: problemSet.id,
      authorId: currentUser.id,
      title,
      body,
      contentFormat,
    },
    select: { id: true },
  });

  try {
    for (const [index, image] of images.entries()) {
      const file = await storeWriteupImage({
        file: image,
        problemSetId: problemSet.id,
        writeupId: writeup.id,
        uploadedById: currentUser.id,
      });
      await prisma.writeupImage.create({
        data: {
          writeupId: writeup.id,
          fileId: file.id,
          sortOrder: index,
        },
      });
    }
  } catch (error) {
    await prisma.writeup.delete({ where: { id: writeup.id } }).catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload images." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, writeupId: writeup.id });
}
