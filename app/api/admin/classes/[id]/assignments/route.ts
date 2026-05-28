import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

export const runtime = "nodejs";

const schema = z.object({
  problemSetId: z.string().min(1),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const { id } = await ctx.params;
  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (user.role !== "ADMIN" && cls.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const set = await prisma.problemSet.findUnique({
    where: { id: parsed.data.problemSetId },
    select: { id: true, status: true },
  });
  if (!set) {
    return NextResponse.json({ error: "Set not found." }, { status: 404 });
  }
  if (set.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Set is not published." }, { status: 422 });
  }

  try {
    const created = await prisma.assignment.create({
      data: {
        classId: id,
        problemSetId: set.id,
        assignedById: session.user.id,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Already assigned to this class." },
        { status: 409 },
      );
    }
    throw err;
  }
}
