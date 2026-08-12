import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { readJsonBody } from "@/lib/http-body";
import {
  isAllowedAvatarUrl,
  MAX_SETTINGS_BODY_BYTES,
  normalizeSettingsPatch,
  settingsPatchSchema,
} from "@/lib/settings-policy";

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
        image: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        group: true,
        profileVisible: true,
        leaderboardVisible: true,
        theme: true,
        greetingSettings: true,
        sidebarPreferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

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

    const body = await readJsonBody(req, { maxBytes: MAX_SETTINGS_BODY_BYTES });
    if (!body.ok) {
      if (body.reason === "too_large") {
        return NextResponse.json({ error: "Settings payload is too large." }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    const parsed = settingsPatchSchema.safeParse(body.value);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settings." }, { status: 422 });
    }
    const {
      avatarUrl,
      displayName,
      profileVisible,
      leaderboardVisible,
      theme,
      greetingSettings,
      sidebarPreferences,
    } = normalizeSettingsPatch(parsed.data);
    if (typeof avatarUrl === "string") {
      if (!isAllowedAvatarUrl(avatarUrl)) {
        return NextResponse.json(
          { error: "Profile picture must be an http(s) URL or uploaded image." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName,
        avatarUrl,
        profileVisible,
        leaderboardVisible,
        theme,
        greetingSettings,
        sidebarPreferences,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        group: true,
        profileVisible: true,
        leaderboardVisible: true,
        theme: true,
        greetingSettings: true,
        sidebarPreferences: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
