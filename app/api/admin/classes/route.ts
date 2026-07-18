import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { displayNameFor } from "@/lib/display-name";
import { validateClassName } from "@/lib/classes";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  studentIds: z.array(z.string().min(1).max(128)).max(200).default([]),
});
const MAX_CLASS_BODY_BYTES = 64_000;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const isAdmin = user.role === "ADMIN";
  const classes = await prisma.class.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { id: true, displayName: true, name: true, email: true } },
      _count: { select: { members: true, assignments: true } },
    },
  });

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      teacher: {
        id: c.teacher.id,
        name: displayNameFor(c.teacher, "Unknown"),
      },
      memberCount: c._count.members,
      assignmentCount: c._count.assignments,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_CLASS_BODY_BYTES });
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

  const validated = validateClassName(parsed.data.name);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 422 });
  }

  // Validate student ids exist.
  const studentIds = Array.from(new Set(parsed.data.studentIds));
  if (studentIds.length > 0) {
    const found = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    if (found.length !== studentIds.length) {
      return NextResponse.json({ error: "Unknown student id." }, { status: 422 });
    }
  }

  const created = await prisma.class.create({
    data: {
      name: validated.value,
      teacherId: session.user.id,
      members: { create: studentIds.map((id) => ({ studentId: id })) },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
