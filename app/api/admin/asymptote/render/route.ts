import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AsymptoteRenderError,
  MAX_ASYMPTOTE_SOURCE_CHARS,
  asymptoteAssetKey,
  renderAsymptotePng,
} from "@/lib/asymptote";
import { readJsonBody } from "@/lib/http-body";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const requestSchema = z.object({
  source: z.string().trim().min(1).max(MAX_ASYMPTOTE_SOURCE_CHARS),
});

const requestsByUser = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const cutoff = Date.now() - 60_000;
  const recent = (requestsByUser.get(userId) ?? []).filter((time) => time >= cutoff);
  if (recent.length >= 10) return true;
  recent.push(Date.now());
  requestsByUser.set(userId, recent);
  return false;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (isRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: "Too many render requests. Try again in a minute." },
      { status: 429 },
    );
  }

  const body = await readJsonBody(request, { maxBytes: MAX_ASYMPTOTE_SOURCE_CHARS + 1_024 });
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === "too_large" ? "Source is too large." : "Invalid JSON." },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Asymptote source is empty or too large." }, { status: 422 });
  }

  try {
    const buffer = await renderAsymptotePng(parsed.data.source);
    const key = asymptoteAssetKey(parsed.data.source);
    return NextResponse.json({
      asset: {
        key,
        name: `${key}.png`,
        mimeType: "image/png",
        dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      },
    });
  } catch (error) {
    if (error instanceof AsymptoteRenderError) {
      const status = error.code === "busy" ? 429 : error.code === "unavailable" ? 503 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Asymptote render failed:", error);
    return NextResponse.json({ error: "Asymptote rendering failed." }, { status: 500 });
  }
}
