import { readFile } from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const MATERIAL_FILES: Record<string, { filePath: string[]; contentType: string }> = {
  "index.html": { filePath: ["index.html"], contentType: "text/html; charset=utf-8" },
  "HKOI初賽限時練習.html": {
    filePath: ["HKOI初賽限時練習.html"],
    contentType: "text/html; charset=utf-8",
  },
  "HKOI 初賽重點題解.html": {
    filePath: ["HKOI 初賽重點題解.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/index.html": {
    filePath: ["three-sets", "index.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/check.html": {
    filePath: ["three-sets", "check.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/collect.js": {
    filePath: ["three-sets", "collect.js"],
    contentType: "application/javascript; charset=utf-8",
  },
  "three-sets/test-a.html": {
    filePath: ["three-sets", "test-a.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/test-b.html": {
    filePath: ["three-sets", "test-b.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/test-c.html": {
    filePath: ["three-sets", "test-c.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/explain-a.html": {
    filePath: ["three-sets", "explain-a.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/explain-b.html": {
    filePath: ["three-sets", "explain-b.html"],
    contentType: "text/html; charset=utf-8",
  },
  "three-sets/explain-c.html": {
    filePath: ["three-sets", "explain-c.html"],
    contentType: "text/html; charset=utf-8",
  },
  "mock/index.html": {
    filePath: ["mock", "index.html"],
    contentType: "text/html; charset=utf-8",
  },
  "mock/test-mock1.html": {
    filePath: ["mock", "test-mock1.html"],
    contentType: "text/html; charset=utf-8",
  },
  "mock/test-mock2.html": {
    filePath: ["mock", "test-mock2.html"],
    contentType: "text/html; charset=utf-8",
  },
  "mock/explain-mock1.html": {
    filePath: ["mock", "explain-mock1.html"],
    contentType: "text/html; charset=utf-8",
  },
  "mock/explain-mock2.html": {
    filePath: ["mock", "explain-mock2.html"],
    contentType: "text/html; charset=utf-8",
  },
};

type MaterialRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, context: MaterialRouteContext) {
  const { path: segments } = await context.params;
  const materialPath = segments.join("/");
  if (!Object.hasOwn(MATERIAL_FILES, materialPath)) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const material = MATERIAL_FILES[materialPath];

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const callbackPath = segments.map(encodeURIComponent).join("/");
    const callbackUrl = `/hkoi/material/${callbackPath}`;
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      Location: `/login?redirect=${encodeURIComponent(callbackUrl)}`,
    });
    return new Response(null, { status: 307, headers });
  }

  let html: Buffer;
  try {
    html = await readFile(path.join(process.cwd(), "protected", "hkoi", ...material.filePath));
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
      "Content-Type": material.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
