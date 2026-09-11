import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";
import { hasPermission } from "@/lib/permissions";
import { fetchGoogleProfile } from "@/lib/google-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (
    isCrossSiteBrowserRequest(request, {
      allowSameSiteWithMatchingOrigin: true,
      expectedOrigin: process.env.NEXTAUTH_URL,
    })
  ) {
    return NextResponse.json({ error: "Cross-site student refresh rejected." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      email: true,
      name: true,
      accounts: {
        where: { provider: "google" },
        orderBy: { id: "asc" },
        take: 1,
        select: {
          id: true,
          access_token: true,
          refresh_token: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of students) {
    const account = student.accounts[0];
    if (!account) {
      skipped += 1;
      continue;
    }
    if (!account.access_token?.trim() && !account.refresh_token?.trim()) {
      skipped += 1;
      continue;
    }

    try {
      const profile = await fetchGoogleProfile(account, { expectedEmail: student.email });
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: student.id },
          data: { name: profile.name },
        });

        if (profile.accessToken) {
          await tx.account.update({
            where: { id: account.id },
            data: {
              access_token: profile.accessToken,
              expires_at: profile.expiresAt ?? null,
            },
          });
        }
      });

      if (student.name === profile.name) unchanged += 1;
      else updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to refresh Google name for student ${student.id}:`, error);
    }
  }

  const result = { total: students.length, updated, unchanged, skipped, failed };
  await recordAuditLog({
    actorId: session.user.id,
    action: "admin.students.refresh_google_names",
    targetType: "User",
    metadata: result,
  });

  return NextResponse.json({ ok: failed === 0, ...result });
}
