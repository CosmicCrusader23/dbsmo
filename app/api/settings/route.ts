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

    const [user, attemptStats] = await Promise.all([
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
      prisma.$queryRaw<
        Array<{ attemptedSets: number; averageScore: number; totalAttempts: number }>
      >`
        SELECT
          COUNT(*)::int AS "totalAttempts",
          COUNT(DISTINCT "problemSetId")::int AS "attemptedSets",
          COALESCE(
            ROUND(AVG(CASE WHEN "maxScore" > 0 THEN "score"::numeric / "maxScore" * 100 ELSE 0 END)),
            0
          )::int AS "averageScore"
        FROM "Attempt"
        WHERE "userId" = ${session.user.id}
      `,
    ]);

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const { _count, ...profile } = user;
    const stats = attemptStats[0] ?? { attemptedSets: 0, averageScore: 0, totalAttempts: 0 };

    return NextResponse.json({
      user: {
        ...profile,
        stats: {
          attemptedSets: stats.attemptedSets,
          totalAttempts: stats.totalAttempts,
          averageScore: stats.averageScore,
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
