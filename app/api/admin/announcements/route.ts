import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  classIds: z.array(z.string().min(1)).min(1).max(50),
});

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const classIds = Array.from(new Set(parsed.data.classIds));
  const classes = await prisma.class.findMany({
    where: {
      id: { in: classIds },
      ...(currentUser.role === "ADMIN" ? {} : { teacherId: currentUser.id }),
    },
    select: { id: true },
  });

  if (classes.length !== classIds.length) {
    return NextResponse.json(
      { error: "One or more selected classes are unavailable." },
      { status: 403 },
    );
  }

  const announcement = await prisma.announcement.create({
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

  return NextResponse.json({ id: announcement.id }, { status: 201 });
}
