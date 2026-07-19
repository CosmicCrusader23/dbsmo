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
import { computePerformanceProfile } from "@/lib/analytics";
import { isVisibleToStudent } from "@/lib/visibility";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user, attempts, problemSets] = await Promise.all([
      prisma.user.findUnique({
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
          _count: {
            select: { practiceSolves: true },
          },
        },
      }),
      prisma.attempt.findMany({
        where: { userId: session.user.id },
        select: { score: true, maxScore: true, problemSetId: true },
      }),
      prisma.problemSet.findMany({
        select: { id: true, status: true, visibleFrom: true, visibleTo: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const { _count, ...profile } = user;
    const visibleSetIds = new Set(
      problemSets.filter((set) => isVisibleToStudent(set)).map((set) => set.id),
    );
    const performance = computePerformanceProfile(
      attempts.filter((attempt) => visibleSetIds.has(attempt.problemSetId)),
      visibleSetIds.size,
    );

    return NextResponse.json({
      user: {
        ...profile,
        stats: {
          attemptedSets: performance.attemptedSets,
          totalAttempts: attempts.length,
          masteryIndex: performance.masteryIndex,
          bestSetAverage: performance.bestSetAverage,
          practiceScore: _count.practiceSolves,
        },
      },
    });
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
    const { avatarUrl, displayName, profileVisible, leaderboardVisible, theme, greetingSettings } =
      normalizeSettingsPatch(parsed.data);

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
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
