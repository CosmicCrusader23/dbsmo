import { describe, expect, it, vi } from "vitest";
import { fetchGoogleProfile } from "@/lib/google-profile";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Google profile refresh", () => {
  it("uses a valid stored access token", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ email: "student@g.dbs.edu.hk", name: "Updated Student" }));

    await expect(
      fetchGoogleProfile(
        { access_token: "access-token", refresh_token: null },
        { expectedEmail: "student@g.dbs.edu.hk", fetchImpl },
      ),
    ).resolves.toEqual({ name: "Updated Student" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired access token before reading the profile", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "new-access-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        jsonResponse({ email: "student@g.dbs.edu.hk", name: "Updated Student" }),
      );

    await expect(
      fetchGoogleProfile(
        { access_token: "old-access-token", refresh_token: "refresh-token" },
        {
          expectedEmail: "student@g.dbs.edu.hk",
          clientId: "client-id",
          clientSecret: "client-secret",
          fetchImpl,
        },
      ),
    ).resolves.toMatchObject({ name: "Updated Student", accessToken: "new-access-token" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects a profile whose email does not match the stored student", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ email: "different@g.dbs.edu.hk", name: "Wrong Student" }));

    await expect(
      fetchGoogleProfile(
        { access_token: "access-token", refresh_token: null },
        { expectedEmail: "student@g.dbs.edu.hk", fetchImpl },
      ),
    ).rejects.toThrow("does not match");
  });
});
