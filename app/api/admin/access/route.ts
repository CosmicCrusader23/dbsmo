import { NextResponse } from "next/server";
import { AuthAllowlistKind } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import {
  authOptions,
  HIDDEN_ALLOWED_EMAIL,
  SCHOOL_EMAIL_DOMAINS,
  VISIBLE_BUILTIN_ALLOWED_EMAILS,
} from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isCrossSiteBrowserRequest, readJsonBody } from "@/lib/http-body";
import { normalizeAllowlistEntry } from "@/lib/auth-policy";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const requestSchema = z.object({
  kind: z.enum(["EMAIL", "DOMAIN"]),
  value: z.string().min(1).max(254),
});
const MAX_BODY_BYTES = 2_048;

async function authorizedActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:allowlist")) return null;
  return { id: session.user.id };
}

export async function GET() {
  const actor = await authorizedActor();
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const entries = await prisma.authAllowlistEntry.findMany({
    where: { value: { not: HIDDEN_ALLOWED_EMAIL } },
    orderBy: [{ kind: "asc" }, { value: "asc" }],
    select: { id: true, kind: true, value: true, createdAt: true },
  });

  return NextResponse.json({
    entries: [
      ...VISIBLE_BUILTIN_ALLOWED_EMAILS.map((value) => ({
        id: `builtin:${value}`,
        kind: "EMAIL" as const,
        value,
        source: "built-in" as const,
        deletable: false,
      })),
      ...SCHOOL_EMAIL_DOMAINS.map((value) => ({
        id: `environment:${value}`,
        kind: "DOMAIN" as const,
        value,
        source: "environment" as const,
        deletable: false,
      })),
      ...entries.map((entry) => ({
        ...entry,
        source: "admin" as const,
        deletable: true,
      })),
    ],
  });
}

export async function POST(request: Request) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const actor = await authorizedActor();
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await readJsonBody(request, { maxBytes: MAX_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === "too_large" ? "Request is too large." : "Invalid JSON." },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose an email or domain and enter a valid value." },
      { status: 422 },
    );
  }
  const entry = normalizeAllowlistEntry(parsed.data.kind, parsed.data.value);
  if (!entry) {
    return NextResponse.json({ error: "Enter a valid email address or domain." }, { status: 422 });
  }
  if (entry.value === HIDDEN_ALLOWED_EMAIL) {
    return NextResponse.json(
      { error: "That address is a protected built-in entry." },
      { status: 409 },
    );
  }
  if (
    (entry.kind === "EMAIL" &&
      VISIBLE_BUILTIN_ALLOWED_EMAILS.includes(
        entry.value as (typeof VISIBLE_BUILTIN_ALLOWED_EMAILS)[number],
      )) ||
    (entry.kind === "DOMAIN" &&
      SCHOOL_EMAIL_DOMAINS.includes(entry.value as (typeof SCHOOL_EMAIL_DOMAINS)[number]))
  ) {
    return NextResponse.json(
      { error: "That email or domain is already whitelisted." },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.authAllowlistEntry.create({
      data: { kind: entry.kind as AuthAllowlistKind, value: entry.value },
      select: { id: true, kind: true, value: true, createdAt: true },
    });
    await recordAuditLog({
      actorId: actor.id,
      action: "auth.allowlist_add",
      targetType: "AuthAllowlistEntry",
      targetId: created.id,
      metadata: { kind: created.kind, value: created.value },
    });
    return NextResponse.json(
      { entry: { ...created, source: "admin", deletable: true } },
      { status: 201 },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "That email or domain is already whitelisted." },
        { status: 409 },
      );
    }
    throw error;
  }
}
