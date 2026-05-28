import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { validateClassName, buildCompletionMap } from "@/lib/classes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function loadAuthorizedClass(classId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    return { error: NextResponse.json({ error: "Class not found." }, { status: 404 }) };
  }
  if (user.role !== "ADMIN" && cls.teacherId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { cls, user };
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const auth = await loadAuthorizedClass(id, session.user.id);
  if ("error" in auth) return auth.error;

  const detail = await prisma.class.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { addedAt: "asc" },
        include: {
          student: { select: { id: true, displayName: true, name: true, email: true } },
        },
      },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          problemSet: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });
  if (!detail) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const studentIds = detail.members.map((m) => m.studentId);
  const setIds = detail.assignments.map((a) => a.problemSetId);
  const attempts =
    studentIds.length === 0 || setIds.length === 0
      ? []
      : await prisma.attempt.findMany({
          where: {
            userId: { in: studentIds },
            problemSetId: { in: setIds },
          },
          select: { userId: true, problemSetId: true, submittedAt: true },
        });

  const assignments = detail.assignments.map((a) => {
    const relevantAttempts = attempts.filter((at) => at.problemSetId === a.problemSetId);
    const completion = buildCompletionMap({
      assignmentCreatedAt: a.createdAt,
      studentIds,
      attempts: relevantAttempts.map((at) => ({ userId: at.userId, submittedAt: at.submittedAt })),
    });
    const completed = Array.from(completion.values()).filter((d) => d !== null).length;
    return {
      id: a.id,
      problemSet: a.problemSet,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      completedCount: completed,
      totalCount: studentIds.length,
      perStudent: detail.members.map((m) => ({
        studentId: m.studentId,
        completedAt: completion.get(m.studentId) ?? null,
      })),
    };
  });

  return NextResponse.json({
    id: detail.id,
    name: detail.name,
    teacherId: detail.teacherId,
    createdAt: detail.createdAt,
    members: detail.members.map((m) => ({
      id: m.studentId,
      name: m.student.displayName ?? m.student.name ?? m.student.email,
      email: m.student.email,
      addedAt: m.addedAt,
    })),
    assignments,
  });
}

const patchSchema = z.object({ name: z.string().min(1).max(120) });

export async function PATCH(request: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const auth = await loadAuthorizedClass(id, session.user.id);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }
  const validated = validateClassName(parsed.data.name);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 422 });
  }
  await prisma.class.update({
    where: { id },
    data: { name: validated.value },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const auth = await loadAuthorizedClass(id, session.user.id);
  if ("error" in auth) return auth.error;
  await prisma.class.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
