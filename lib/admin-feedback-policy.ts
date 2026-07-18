import { FeedbackStatus, type Prisma } from "@prisma/client";
import { z } from "zod";

export const MAX_ADMIN_FEEDBACK_BODY_BYTES = 16_384;
export const MAX_ADMIN_NOTE_CHARS = 2_000;

export const adminFeedbackUpdateSchema = z.object({
  status: z.enum(FeedbackStatus),
  adminNote: z.string().max(MAX_ADMIN_NOTE_CHARS).nullable().optional(),
});

export const legacyAdminFeedbackUpdateSchema = adminFeedbackUpdateSchema.extend({
  reportId: z.string().trim().min(1).max(128),
});

export function buildFeedbackUpdateData(
  input: z.infer<typeof adminFeedbackUpdateSchema>,
  resolvedAt = new Date(),
): Prisma.FeedbackReportUpdateInput {
  const terminal = input.status === "RESOLVED" || input.status === "REJECTED";
  return {
    status: input.status,
    ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
    resolvedAt: terminal ? resolvedAt : null,
  };
}
