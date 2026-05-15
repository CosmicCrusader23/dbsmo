import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { dryRunProblemSetJson, importProblemSetJson } from "@/lib/import/json-import";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const upload = formData.get("file");
  const intent = formData.get("intent");

  if (!(upload instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        issues: [{ level: "error", message: "No JSON file was uploaded." }],
        preview: null,
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
        preview: null,
      },
      { status: 413 },
    );
  }

  const payload = {
    fileName: upload.name,
    sizeBytes: upload.size,
    text: await upload.text(),
  };

  if (intent === "replace") {
    const result = await importProblemSetJson(
      {
        ...payload,
        uploadedById: session.user.id,
      },
      { replaceSetId: id },
    );

    if (result.ok && result.created) {
      await recordAuditLog({
        actorId: session.user.id,
        action: "problem_set.replace_json",
        targetType: "ProblemSet",
        targetId: id,
        metadata: { slug: result.created.slug, fileName: upload.name },
      });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  const result = await dryRunProblemSetJson(payload, { replaceSetId: id });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
