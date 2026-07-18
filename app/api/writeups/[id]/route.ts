import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cleanupUnreferencedImportedFiles } from "@/lib/imported-file-cleanup";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
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
  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(writeup.problemSet)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (currentUser.role !== "ADMIN" && writeup.authorId !== currentUser.id) {
    return NextResponse.json(
      { error: "Only the author or an admin can delete this." },
      { status: 403 },
    );
  }

  const fileIds = writeup.images.map((image) => image.file.id);
  await prisma.writeup.delete({ where: { id } });
  await cleanupUnreferencedImportedFiles(fileIds).catch((error) => {
    console.error(`Failed to clean up images for deleted writeup ${id}:`, error);
  });

  return NextResponse.json({ ok: true });
}
