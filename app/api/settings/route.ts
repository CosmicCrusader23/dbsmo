import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

const MAX_AVATAR_URL_LENGTH = 700_000;

function normalizeAvatarUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed;
}

function isAllowedAvatarUrl(value: string) {
  return (
    /^https?:\/\/[^\s]+$/i.test(value) ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)
  );
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        group: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { displayName?: unknown; avatarUrl?: unknown };
    const { displayName, avatarUrl } = body;
    const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl);

    if (displayName !== undefined && displayName !== null) {
      const trimmed = String(displayName).trim();
      if (trimmed.length > 50) {
        return NextResponse.json(
          { error: "Display name must be 50 characters or fewer." },
          { status: 400 },
        );
      }
    }

    if (typeof normalizedAvatarUrl === "string") {
      if (normalizedAvatarUrl.length > MAX_AVATAR_URL_LENGTH) {
        return NextResponse.json(
          { error: "Profile picture is too large. Use an image under 512 KB." },
          { status: 400 },
        );
      }
      if (!isAllowedAvatarUrl(normalizedAvatarUrl)) {
        return NextResponse.json(
          { error: "Profile picture must be an http(s) URL or uploaded image." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: displayName !== undefined ? String(displayName).trim() || null : undefined,
        avatarUrl: normalizedAvatarUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        group: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
