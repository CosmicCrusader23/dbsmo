import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditInput = {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordAuditLog({
  actorId,
  action,
  targetType = null,
  targetId = null,
  metadata = null,
}: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        targetType,
        targetId,
        metadata: metadata === null ? undefined : (metadata as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
  }
}
