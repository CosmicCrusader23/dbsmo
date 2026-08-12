import { z } from "zod";
import { normalizeDisplayText } from "./display-name";
import { parseSidebarPreferencesInput } from "./sidebar-preferences";

export const MAX_AVATAR_URL_LENGTH = 700_000;
export const MAX_SETTINGS_BODY_BYTES = 750_000;
export const MAX_GREETING_SETTINGS_LENGTH = 2_000;
export const MAX_SIDEBAR_PREFERENCES_LENGTH = 10_000;

const greetingSettingsValueSchema = z
  .object({
    typeSpeed: z.number().min(10).max(500).optional(),
    deleteSpeed: z.number().min(10).max(500).optional(),
    holdMs: z.number().min(500).max(15_000).optional(),
    betweenMs: z.number().min(100).max(5_000).optional(),
  })
  .strict();

const greetingSettingsJsonSchema = z
  .string()
  .max(MAX_GREETING_SETTINGS_LENGTH)
  .transform((value, context) => {
    try {
      const parsed = greetingSettingsValueSchema.safeParse(JSON.parse(value));
      if (parsed.success) return JSON.stringify(parsed.data);
    } catch {
      // Report the same public validation error for malformed and invalid JSON values.
    }

    context.addIssue({ code: "custom", message: "Invalid greeting settings." });
    return z.NEVER;
  });

const sidebarPreferencesJsonSchema = z
  .string()
  .max(MAX_SIDEBAR_PREFERENCES_LENGTH)
  .transform((value, context) => {
    const parsed = parseSidebarPreferencesInput(value);
    if (parsed) return JSON.stringify(parsed);

    context.addIssue({ code: "custom", message: "Invalid sidebar preferences." });
    return z.NEVER;
  });

export const settingsPatchSchema = z
  .object({
    avatarUrl: z.string().max(MAX_AVATAR_URL_LENGTH).nullable().optional(),
    displayName: z.string().max(50).nullable().optional(),
    greetingSettings: greetingSettingsJsonSchema.nullable().optional(),
    sidebarPreferences: sidebarPreferencesJsonSchema.nullable().optional(),
    leaderboardVisible: z.boolean().optional(),
    profileVisible: z.boolean().optional(),
    theme: z.enum(["light", "dark"]).optional(),
  })
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export function normalizeAvatarUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed || null;
}

export function isAllowedAvatarUrl(value: string): boolean {
  return (
    /^https?:\/\/[^\s]+$/i.test(value) ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)
  );
}

export function normalizeSettingsPatch(input: SettingsPatch) {
  return {
    ...input,
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    displayName:
      input.displayName === undefined ? undefined : normalizeDisplayText(input.displayName),
  };
}
