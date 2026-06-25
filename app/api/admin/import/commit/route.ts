import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { importProblemSetJson } from "@/lib/import/json-import";
import { readOptionalImageZip } from "@/lib/import/uploaded-image-zip";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const upload = formData.get("file");

  if (!(upload instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        issues: [{ level: "error", message: "No JSON file was uploaded." }],
        created: null,
      },
      { status: 400 },
    );
  }

  const maxMb = parseInt(process.env.MAX_JSON_UPLOAD_MB || "5", 10);
  if (upload.size > maxMb * 1024 * 1024) {
    return NextResponse.json(
      {
        ok: false,
        issues: [{ level: "error", message: `File size exceeds the ${maxMb}MB limit.` }],
        created: null,
      },
      { status: 413 },
    );
  }

  const imageZip = await readOptionalImageZip(formData, upload.name);
  if (imageZip.issues.some((issue) => issue.level === "error")) {
    return NextResponse.json(
      {
        ok: false,
        issues: imageZip.issues,
        created: null,
      },
      { status: 422 },
    );
  }

  const result = await importProblemSetJson({
    fileName: upload.name,
    sizeBytes: upload.size,
    text: await upload.text(),
    uploadedById: session.user.id,
    imageZip: imageZip.imageZip,
  });

  if (result.ok && result.created) {
    await recordAuditLog({
      actorId: session.user.id,
      action: "problem_set.import_json",
      targetType: "ProblemSet",
      targetId: result.created.problemSetId,
      metadata: { slug: result.created.slug, fileName: upload.name },
    });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
