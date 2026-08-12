import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cleanupUnreferencedImportedFiles } from "@/lib/imported-file-cleanup";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const [currentUser, writeup] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.writeup.findUnique({
      where: { id },
      include: {
        problemSet: true,
        images: {
          include: {
            file: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!currentUser || !writeup) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (currentUser.role !== "ADMIN" && writeup.authorId !== currentUser.id) {
    if (!isVisibleToStudent(writeup.problemSet)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Only the author or an admin can delete this." },
      { status: 403 },
    );
  }

  const fileIds = writeup.images.map((image) => image.file.id);
  const deleted = await prisma.writeup.deleteMany({
    where: {
      id,
      ...(currentUser.role === "ADMIN" ? {} : { authorId: currentUser.id }),
    },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await cleanupUnreferencedImportedFiles(fileIds).catch((error) => {
    console.error(`Failed to clean up images for deleted writeup ${id}:`, error);
  });

  return NextResponse.json({ ok: true });
}
