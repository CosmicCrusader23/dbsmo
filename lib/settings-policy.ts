import { z } from "zod";
import { normalizeDisplayText } from "./display-name";

export const MAX_AVATAR_URL_LENGTH = 700_000;
export const MAX_SETTINGS_BODY_BYTES = 750_000;
export const MAX_GREETING_SETTINGS_LENGTH = 2_000;

export const settingsPatchSchema = z.object({
  avatarUrl: z.string().max(MAX_AVATAR_URL_LENGTH).nullable().optional(),
  displayName: z.string().max(50).nullable().optional(),
  greetingSettings: z.string().max(MAX_GREETING_SETTINGS_LENGTH).nullable().optional(),
  leaderboardVisible: z.boolean().optional(),
  profileVisible: z.boolean().optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

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
