import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const patchSchema = z.object({
  dueAt: z.string().datetime().nullable(),
});
const MAX_ASSIGNMENT_BODY_BYTES = 2_048;

async function authorize(classId: string, assignmentId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: { select: { teacherId: true, id: true } } },
  });
  if (!a || a.classId !== classId) {
    return { error: NextResponse.json({ error: "Assignment not found." }, { status: 404 }) };
  }
  if (user.role !== "ADMIN" && a.class.teacherId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { ok: true } as const;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; aid: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id, aid } = await ctx.params;
  const auth = await authorize(id, aid, session.user.id);
  if ("error" in auth) return auth.error;

  const body = await readJsonBody(request, { maxBytes: MAX_ASSIGNMENT_BODY_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  await prisma.assignment.update({
    where: { id: aid },
    data: { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id, aid } = await ctx.params;
  const auth = await authorize(id, aid, session.user.id);
  if ("error" in auth) return auth.error;

  await prisma.assignment.delete({ where: { id: aid } });
  return NextResponse.json({ ok: true });
}
