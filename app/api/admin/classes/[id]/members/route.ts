import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const schema = z.object({
  studentIds: z.array(z.string().min(1).max(128)).min(1).max(200),
});
const MAX_CLASS_BODY_BYTES = 64_000;

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

  const body = await readJsonBody(request, { maxBytes: MAX_CLASS_BODY_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const studentIds = Array.from(new Set(parsed.data.studentIds));
  const found = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true },
  });
  if (found.length !== studentIds.length) {
    return NextResponse.json({ error: "Unknown student id." }, { status: 422 });
  }

  await prisma.classMember.createMany({
    data: studentIds.map((sid) => ({ classId: id, studentId: sid })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}
