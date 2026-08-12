import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

import { GET, PATCH } from "../app/api/settings/route";

const USER = {
  id: "user-1",
  email: "student@g.dbs.edu.hk",
  name: "Student",
  image: null,
  displayName: "Student",
  avatarUrl: null,
  role: "STUDENT",
  group: null,
  profileVisible: true,
  leaderboardVisible: true,
  theme: "light",
  greetingSettings: null,
  sidebarPreferences: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerSession.mockResolvedValue({ user: { id: USER.id } });
  mocks.userFindUnique.mockResolvedValue(USER);
  mocks.userUpdate.mockResolvedValue(USER);
});

describe("settings API", () => {
  it("rejects unauthenticated requests before reading user data", async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("loads only the profile data required by the settings screen", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: USER });
    expect(mocks.userFindUnique).toHaveBeenCalledOnce();
    expect(mocks.userFindUnique.mock.calls[0][0].select).not.toHaveProperty("_count");
  });

  it("rejects malformed sidebar preferences before updating the user", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ sidebarPreferences: "not json" }),
      }),
    );

    expect(response.status).toBe(422);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("persists canonical greeting and sidebar settings", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          greetingSettings: '{"holdMs":1200,"typeSpeed":35}',
          sidebarPreferences:
            '{"enabled":["/admin/sets"],"hidden":[],"order":[" /dashboard ","/dashboard"]}',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          greetingSettings: '{"typeSpeed":35,"holdMs":1200}',
          sidebarPreferences: '{"order":["/dashboard"],"hidden":[],"enabled":["/admin/sets"]}',
        }),
      }),
    );
  });
});
