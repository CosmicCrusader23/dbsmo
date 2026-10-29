import { readFile } from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const MATERIAL_FILES = new Set(["index.html", "HKOI初賽限時練習.html", "HKOI 初賽重點題解.html"]);

type MaterialRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: MaterialRouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { path: segments } = await context.params;
  const fileName = segments.length === 1 ? segments[0] : "";
  if (!MATERIAL_FILES.has(fileName)) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let html: Buffer;
  try {
    html = await readFile(path.join(process.cwd(), "protected", "hkoi", fileName));
  } catch (error) {
    console.error("Failed to read HKOI material:", error);
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return new NextResponse(new Uint8Array(html), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
