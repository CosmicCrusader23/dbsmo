import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { readFileBufferBounded, StorageReadLimitError } from "@/lib/storage";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

const INLINE_SAFE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);
const MAX_FILE_DOWNLOAD_BYTES = 100 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function contentDispositionFilename(name: string): string {
  const cleaned = name
    .replace(/[^\x20-\x7e]+/g, "-")
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 160);
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
        problemFileFor: {
          select: { status: true, visibleFrom: true, visibleTo: true },
        },
        solutionFileFor: {
          select: { status: true, visibleFrom: true, visibleTo: true },
        },
        assetFor: {
          select: {
            problemSet: { select: { status: true, visibleFrom: true, visibleTo: true } },
          },
        },
        writeupImageFor: {
          select: {
            writeup: {
              select: {
                problemSet: { select: { status: true, visibleFrom: true, visibleTo: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!currentUser || !file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const relatedSets = [
    ...file.problemFileFor,
    ...file.solutionFileFor,
    ...file.assetFor.map((a) => a.problemSet),
    ...file.writeupImageFor.map((image) => image.writeup.problemSet),
  ];
  const canRead =
    relatedSets.some((set) => isVisibleToStudent(set)) ||
    (relatedSets.length > 0 && hasPermission(currentUser.role, "admin:content"));

  if (!canRead) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFileBufferBounded(file.storageKey, MAX_FILE_DOWNLOAD_BYTES);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== file.sizeBytes || checksum !== file.checksum.trim().toLowerCase()) {
      console.error(`Stored file integrity check failed for ${file.id}.`);
      return NextResponse.json({ error: "Stored file is unavailable." }, { status: 409 });
    }
  } catch (error) {
    if (error instanceof StorageReadLimitError) {
      return NextResponse.json({ error: "Stored file is too large." }, { status: 413 });
    }
    console.error("Failed to read imported file:", error);
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const responseMime = INLINE_SAFE_MIME.has(file.mimeType)
    ? file.mimeType
    : "application/octet-stream";

  return new NextResponse(new Blob([new Uint8Array(bytes)]), {
    headers: {
      "Content-Type": responseMime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${INLINE_SAFE_MIME.has(file.mimeType) ? "inline" : "attachment"}; filename="${contentDispositionFilename(file.originalName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
