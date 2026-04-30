import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { importProblemSetJson } from "@/lib/import/json-import";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
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

  const result = await importProblemSetJson({
    fileName: upload.name,
    sizeBytes: upload.size,
    text: await upload.text(),
    uploadedById: session.user.id,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
