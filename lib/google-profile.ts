const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

type FetchImplementation = typeof fetch;

export type GoogleAccountTokens = {
  access_token: string | null;
  refresh_token: string | null;
};

export type GoogleProfileRefresh = {
  name: string;
  accessToken?: string;
  expiresAt?: number;
};

type GoogleProfileResponse = {
  email?: unknown;
  name?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestGoogleProfile(
  accessToken: string,
  fetchImpl: FetchImplementation,
): Promise<{ response: Response; profile: GoogleProfileResponse | null }> {
  const response = await fetchImpl(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });
  const payload = await readJson(response);
  return {
    response,
    profile: isRecord(payload) ? payload : null,
  };
}

async function refreshGoogleAccessToken(
  refreshToken: string,
  fetchImpl: FetchImplementation,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt?: number }> {
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });
  const payload = await readJson(response);
  const accessTokenValue = isRecord(payload) ? payload.access_token : undefined;
  if (!response.ok || typeof accessTokenValue !== "string" || !accessTokenValue) {
    throw new Error(`Google token refresh failed (${response.status}).`);
  }

  const expiresIn =
    isRecord(payload) && typeof payload.expires_in === "number" ? payload.expires_in : null;
  return {
    accessToken: accessTokenValue,
    expiresAt: expiresIn !== null ? Math.floor(Date.now() / 1000) + expiresIn : undefined,
  };
}

function profileName(profile: GoogleProfileResponse | null): string | null {
  if (typeof profile?.name !== "string") return null;
  const name = profile.name.trim();
  return name || null;
}

export async function fetchGoogleProfile(
  account: GoogleAccountTokens,
  {
    expectedEmail,
    fetchImpl = fetch,
    clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
  }: {
    expectedEmail: string;
    fetchImpl?: FetchImplementation;
    clientId?: string;
    clientSecret?: string;
  },
): Promise<GoogleProfileRefresh> {
  let accessToken = account.access_token?.trim() || null;

  if (accessToken) {
    const current = await requestGoogleProfile(accessToken, fetchImpl);
    const currentName = profileName(current.profile);
    if (current.response.ok && currentName) {
      if (
        typeof current.profile?.email === "string" &&
        normalizedEmail(current.profile.email) !== normalizedEmail(expectedEmail)
      ) {
        throw new Error("Google account email does not match the stored student account.");
      }
      return { name: currentName };
    }

    if (current.response.status !== 401) {
      throw new Error(`Google profile request failed (${current.response.status}).`);
    }
  }

  const refreshToken = account.refresh_token?.trim() || null;
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("No usable Google token is available for this student.");
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken, fetchImpl, clientId, clientSecret);
  accessToken = refreshed.accessToken;

  const refreshedProfile = await requestGoogleProfile(accessToken, fetchImpl);
  const refreshedName = profileName(refreshedProfile.profile);
  if (!refreshedProfile.response.ok || !refreshedName) {
    throw new Error(`Google profile request failed (${refreshedProfile.response.status}).`);
  }
  if (
    typeof refreshedProfile.profile?.email === "string" &&
    normalizedEmail(refreshedProfile.profile.email) !== normalizedEmail(expectedEmail)
  ) {
    throw new Error("Google account email does not match the stored student account.");
  }

  return { name: refreshedName, accessToken, expiresAt: refreshed.expiresAt };
}
