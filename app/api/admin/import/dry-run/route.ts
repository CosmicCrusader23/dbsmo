import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dryRunProblemSetJson } from "@/lib/import/json-import";
import { readOptionalImageZip } from "@/lib/import/uploaded-image-zip";
import { authOptions } from "@/lib/auth";
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
