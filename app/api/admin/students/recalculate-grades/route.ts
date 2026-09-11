import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";
import { hasPermission } from "@/lib/permissions";
import { gradeFromStudentEmail, schoolYearLabel } from "@/lib/student-grade";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (
    isCrossSiteBrowserRequest(request, {
      allowSameSiteWithMatchingOrigin: true,
      expectedOrigin: process.env.NEXTAUTH_URL,
    })
  ) {
    return NextResponse.json({ error: "Cross-site grade recalculation rejected." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, email: true, grade: true },
    orderBy: { id: "asc" },
  });
  const now = new Date();
  const schoolYear = schoolYearLabel(now);

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of students) {
    const grade = gradeFromStudentEmail(student.email, now);
    if (grade === null) {
      skipped += 1;
      continue;
    }
    if (student.grade === grade) {
      unchanged += 1;
      continue;
    }

    try {
      await prisma.user.update({ where: { id: student.id }, data: { grade } });
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to recalculate grade for student ${student.id}:`, error);
    }
  }

  const result = { total: students.length, schoolYear, updated, unchanged, skipped, failed };
  await recordAuditLog({
    actorId: session.user.id,
    action: "admin.students.recalculate_grades",
    targetType: "User",
    metadata: result,
  });

  return NextResponse.json({ ok: failed === 0, ...result });
}
