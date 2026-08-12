import { describe, expect, it } from "vitest";
import {
  isAllowedAvatarUrl,
  normalizeSettingsPatch,
  settingsPatchSchema,
} from "../lib/settings-policy";

describe("settings policy", () => {
  it("clears a null display name instead of storing the word null", () => {
    const parsed = settingsPatchSchema.parse({ displayName: null });
    expect(normalizeSettingsPatch(parsed).displayName).toBeNull();
  });

  it("normalizes empty names and avatar URLs to null", () => {
    const parsed = settingsPatchSchema.parse({ displayName: "  ", avatarUrl: "  " });
    expect(normalizeSettingsPatch(parsed)).toMatchObject({ displayName: null, avatarUrl: null });
  });

  it("rejects unbounded or invalid preference values", () => {
    expect(settingsPatchSchema.safeParse({ theme: "system" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ greetingSettings: "x".repeat(2_001) }).success).toBe(
      false,
    );
    expect(settingsPatchSchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it("validates and canonicalizes greeting settings JSON", () => {
    const parsed = settingsPatchSchema.parse({
      greetingSettings: '{"holdMs":1200,"typeSpeed":35}',
    });

    expect(parsed.greetingSettings).toBe('{"typeSpeed":35,"holdMs":1200}');
    expect(settingsPatchSchema.safeParse({ greetingSettings: "not json" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ greetingSettings: '{"typeSpeed":0}' }).success).toBe(
      false,
    );
    expect(
      settingsPatchSchema.safeParse({ greetingSettings: '{"typeSpeed":35,"extra":1}' }).success,
    ).toBe(false);
  });

  it("rejects malformed or user-defined sidebar destinations", () => {
    expect(
      settingsPatchSchema.safeParse({
        sidebarPreferences: '{"order":["/dashboard"],"hidden":[],"enabled":[]}',
      }).success,
    ).toBe(true);
    expect(settingsPatchSchema.safeParse({ sidebarPreferences: "not json" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ sidebarPreferences: '{"order":[1]}' }).success).toBe(
      false,
    );
    expect(
      settingsPatchSchema.safeParse({
        sidebarPreferences: '{"order":[],"custom":[{"href":"https://example.com"}]}',
      }).success,
    ).toBe(false);
  });

  it("allows only remote HTTP images or inert raster data URLs", () => {
    expect(isAllowedAvatarUrl("https://example.com/avatar.png")).toBe(true);
    expect(isAllowedAvatarUrl("data:image/png;base64,aGVsbG8=")).toBe(true);
    expect(isAllowedAvatarUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isAllowedAvatarUrl("javascript:alert(1)")).toBe(false);
  });
});
