import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ProblemContentFormat } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToStudent } from "@/lib/visibility";
import {
  cleanupStoredWriteupImages,
  MAX_WRITEUP_IMAGE_TOTAL_BYTES,
  prepareWriteupImages,
  storePreparedWriteupImage,
  WriteupImageValidationError,
  type PreparedWriteupImage,
  type StoredWriteupImage,
} from "@/lib/writeup-images";
import { readFormDataBody } from "@/lib/http-body";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_WRITEUP_BODY_CHARS = 20000;
const MAX_WRITEUP_TITLE_CHARS = 120;
const MAX_WRITEUP_FORM_BYTES = MAX_WRITEUP_IMAGE_TOTAL_BYTES + 512 * 1024;

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

  const parsedForm = await readFormDataBody(request, { maxBytes: MAX_WRITEUP_FORM_BYTES });
  if (!parsedForm.ok) {
    return NextResponse.json(
      {
        error:
          parsedForm.reason === "too_large"
            ? "Writeup upload is too large."
            : "Invalid writeup form data.",
      },
      { status: parsedForm.reason === "too_large" ? 413 : 400 },
    );
  }
  const formData = parsedForm.value;
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, MAX_WRITEUP_TITLE_CHARS);
  const body = String(formData.get("body") ?? "").trim();
  const contentFormat = normalizeContentFormat(formData.get("contentFormat"));
  const imageEntries = formData.getAll("images");
  const images = imageEntries.filter((entry): entry is File => entry instanceof File);

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (body.length > MAX_WRITEUP_BODY_CHARS) {
    return NextResponse.json({ error: "Writeup text is too long." }, { status: 400 });
  }
  if (!body && images.length === 0) {
    return NextResponse.json({ error: "Add LaTeX text or at least one image." }, { status: 400 });
  }
  if (images.length !== imageEntries.length) {
    return NextResponse.json({ error: "Images must be file uploads." }, { status: 400 });
  }

  let preparedImages: PreparedWriteupImage[];
  try {
    preparedImages = await prepareWriteupImages(images);
  } catch (error) {
    if (!(error instanceof WriteupImageValidationError)) {
      console.error("Failed to read writeup image upload:", error);
      return NextResponse.json({ error: "Could not read image upload." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
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

  const storedImages: StoredWriteupImage[] = [];
  try {
    for (const [index, image] of preparedImages.entries()) {
      const stored = await storePreparedWriteupImage({
        image,
        problemSetId: problemSet.id,
        writeupId: writeup.id,
        uploadedById: currentUser.id,
        sortOrder: index,
      });
      storedImages.push(stored);
    }
  } catch (error) {
    await prisma.writeup.delete({ where: { id: writeup.id } }).catch(() => {});
    await cleanupStoredWriteupImages(storedImages);
    console.error("Failed to persist writeup images:", error);
    return NextResponse.json({ error: "Could not upload images." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, writeupId: writeup.id });
}
