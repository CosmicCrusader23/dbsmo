import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { isCrossSiteBrowserRequest, readJsonBody } from "@/lib/http-body";
import { isPrismaKnownError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  classIds: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
});
const MAX_ANNOUNCEMENT_BODY_BYTES = 32_000;

export async function POST(request: Request) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!currentUser || !hasPermission(currentUser.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_ANNOUNCEMENT_BODY_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const classIds = Array.from(new Set(parsed.data.classIds));
  let announcement: { id: string } | null;
  try {
    announcement = await prisma.$transaction(
      async (tx) => {
        const classes = await tx.class.findMany({
          where: {
            id: { in: classIds },
            ...(currentUser.role === "ADMIN" ? {} : { teacherId: currentUser.id }),
          },
          select: { id: true },
        });

        if (classes.length !== classIds.length) return null;

        return tx.announcement.create({
          data: {
            title: parsed.data.title,
            body: parsed.data.body,
            createdById: currentUser.id,
            classes: {
              connect: classIds.map((id) => ({ id })),
            },
          },
          select: { id: true },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (
      isPrismaKnownError(error, "P2003") ||
      isPrismaKnownError(error, "P2025") ||
      isPrismaKnownError(error, "P2034")
    ) {
      return NextResponse.json(
        { error: "Selected classes changed. Refresh and try again." },
        { status: 409 },
      );
    }
    throw error;
  }

  if (!announcement) {
    return NextResponse.json(
      { error: "One or more selected classes are unavailable." },
      { status: 403 },
    );
  }

  return NextResponse.json({ id: announcement.id }, { status: 201 });
}
