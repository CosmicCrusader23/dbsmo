import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createProblemSetJsonDraft } from "@/lib/import/json-import";
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
        draft: null,
      },
      { status: 400 },
    );
  }

  const result = await createProblemSetJsonDraft({
    fileName: upload.name,
    sizeBytes: upload.size,
    text: await upload.text(),
  });

  return NextResponse.json(result, { status: result.draft ? 200 : 422 });
}
