import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { configuredMaxJsonBytes, importProblemSetJson } from "@/lib/import/json-import";
import { MAX_IMAGE_ZIP_BYTES } from "@/lib/import/image-zip";
import { readOptionalImageZip } from "@/lib/import/uploaded-image-zip";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { readFormDataBody } from "@/lib/http-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const maxJsonBytes = configuredMaxJsonBytes();
  const parsedForm = await readFormDataBody(request, {
    maxBytes: maxJsonBytes + MAX_IMAGE_ZIP_BYTES + 1024 * 1024,
  });
  if (!parsedForm.ok) {
    return NextResponse.json(
      {
        ok: false,
        issues: [
          {
            level: "error",
            message:
              parsedForm.reason === "too_large"
                ? "Import upload is too large."
                : "Import form data is invalid.",
          },
        ],
        created: null,
      },
      { status: parsedForm.reason === "too_large" ? 413 : 400 },
    );
  }
  const formData = parsedForm.value;
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

  if (upload.size > maxJsonBytes) {
    return NextResponse.json(
      {
        ok: false,
        issues: [
          {
            level: "error",
            message: `File size exceeds the ${maxJsonBytes / 1024 / 1024}MB limit.`,
          },
        ],
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
