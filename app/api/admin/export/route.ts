import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AdminExportLimitError, buildAttemptsCsv, buildStudentsCsv } from "@/lib/admin-exports";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (isCrossSiteBrowserRequest(req)) {
    return NextResponse.json({ error: "Cross-site export request rejected." }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:export")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "attempts";

  try {
    if (type === "students") {
      return await exportStudents();
    }
    return await exportAttempts();
  } catch (error) {
    if (error instanceof AdminExportLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error("Failed to build admin CSV export:", error);
    return NextResponse.json({ error: "Export could not be generated." }, { status: 500 });
  }
}

async function exportStudents() {
  const csv = await buildStudentsCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="students.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function exportAttempts() {
  const csv = await buildAttemptsCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attempts.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
