import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFilePath } from "@/lib/storage";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function contentDispositionFilename(name: string): string {
  const cleaned = name
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]+/g, "-")
    .trim();
  return cleaned || "file";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const [currentUser, file] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.importedFile.findUnique({
      where: { id },
      include: {
        problemFileFor: true,
        solutionFileFor: true,
      },
    }),
  ]);

  if (!currentUser || !file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const relatedSets = [...file.problemFileFor, ...file.solutionFileFor];
  const canRead =
    currentUser.role === "ADMIN" || relatedSets.some((set) => isVisibleToStudent(set));

  if (!canRead) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(getFilePath(file.storageKey));
  } catch (error) {
    console.error("Failed to read imported file:", error);
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(new Blob([new Uint8Array(bytes)]), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="${contentDispositionFilename(file.originalName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
