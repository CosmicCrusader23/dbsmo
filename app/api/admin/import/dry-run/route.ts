import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { configuredMaxJsonBytes, dryRunProblemSetJson } from "@/lib/import/json-import";
import { MAX_IMAGE_ZIP_BYTES } from "@/lib/import/image-zip";
import { readOptionalImageZip } from "@/lib/import/uploaded-image-zip";
import { authOptions } from "@/lib/auth";
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
        preview: null,
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
        preview: null,
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
        preview: null,
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
        preview: null,
      },
      { status: 422 },
    );
  }

  const result = await dryRunProblemSetJson({
    fileName: upload.name,
    sizeBytes: upload.size,
    text: await upload.text(),
    imageZip: imageZip.imageZip,
  });

  return NextResponse.json(result);
}
