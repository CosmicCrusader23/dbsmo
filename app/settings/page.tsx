"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Save, User, CheckCircle2, AlertCircle, Moon, Sun } from "lucide-react";
import { Avatar } from "@/app/avatar";

const MAX_AVATAR_BYTES = 512 * 1024;
const THEME_STORAGE_KEY = "mo-theme";

type ThemePreference = "light" | "dark";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

function applyThemePreference(theme: ThemePreference) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event("storage"));
}

function getThemeSnapshot(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedTheme) ? storedTheme : "light";
}

function subscribeThemePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  group: string | null;
  profileVisible: boolean;
  leaderboardVisible: boolean;
  theme?: string;
  greetingSettings?: string;
  stats?: {
    attemptedSets: number;
    totalAttempts: number;
    averageScore: number;
    practiceScore: number;
  };
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileVisible, setProfileVisible] = useState(true);
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typewriterSettings, setTypewriterSettings] = useState({
    typeSpeed: 42,
    deleteSpeed: 22,
    holdMs: 3676,
    betweenMs: 280,
  });
  const themePreference = useSyncExternalStore<ThemePreference>(
    subscribeThemePreference,
    getThemeSnapshot,
    () => "light",
  );

  function handleAvatarFile(file: File | undefined) {
    setError(null);
    setSuccess(null);

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Profile picture must be an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Profile picture must be under 512 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.onerror = () => setError("Could not read that image file.");
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setDisplayName(data.user.displayName || "");
          setAvatarUrl(data.user.avatarUrl || "");
          setProfileVisible(data.user.profileVisible ?? true);
          setLeaderboardVisible(data.user.leaderboardVisible ?? true);

          if (data.user.theme && isThemePreference(data.user.theme)) {
            applyThemePreference(data.user.theme);
          }
          if (data.user.greetingSettings) {
            try {
              const parsed = JSON.parse(data.user.greetingSettings);
              setTypewriterSettings((prev) => ({ ...prev, ...parsed }));
              localStorage.setItem("mo-typewriter-settings", data.user.greetingSettings);
            } catch {}
          }
        }
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));

    try {
      const storedThemeSettings = localStorage.getItem("mo-typewriter-settings");
      if (storedThemeSettings) {
        const parsedSettings = JSON.parse(storedThemeSettings);
        queueMicrotask(() => {
          setTypewriterSettings((prev) => ({ ...prev, ...parsedSettings }));
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    applyThemePreference(themePreference);
  }, [themePreference]);

  function handleThemePreference(theme: ThemePreference) {
    applyThemePreference(theme);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    
    let parsedTypewriter = typewriterSettings;
    try {
      parsedTypewriter = {
        typeSpeed: Math.max(10, Math.min(500, Number(typewriterSettings.typeSpeed) || 42)),
        deleteSpeed: Math.max(10, Math.min(500, Number(typewriterSettings.deleteSpeed) || 22)),
        holdMs: Math.max(500, Math.min(15000, Number(typewriterSettings.holdMs) || 3676)),
        betweenMs: Math.max(100, Math.min(5000, Number(typewriterSettings.betweenMs) || 280)),
      };
      localStorage.setItem("mo-typewriter-settings", JSON.stringify(parsedTypewriter));
      setTypewriterSettings(parsedTypewriter);
      window.dispatchEvent(new Event("storage"));
    } catch {}

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          profileVisible,
          leaderboardVisible,
          theme: themePreference,
          greetingSettings: JSON.stringify(parsedTypewriter),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save.");
        return;
      }

      setUser((currentUser) => ({
        ...data.user,
        stats: currentUser?.stats,
      }));
      setSuccess("Settings saved!");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="settings-shell">
        <p className="settings-loading">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="settings-shell">
        <p className="settings-loading">Not signed in.</p>
      </main>
    );
  }

  const customAvatar = avatarUrl.trim();
  const currentAvatar = customAvatar || user.image?.trim() || "";
  const previewName = displayName.trim() || user.name || "";

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
        </div>
        <Link className="secondary-action" href="/dashboard">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </header>

      {error && (
        <div className="create-set-alert create-set-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="create-set-alert create-set-alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <section className="settings-card">
        <div className="settings-avatar-section">
          <div className="settings-avatar-preview">
            {currentAvatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentAvatar}
                alt="Profile"
                className="settings-avatar-img"
                onError={() => {
                  if (customAvatar) {
                    setAvatarUrl("");
                    setError("That profile picture could not be loaded.");
                  } else {
                    setError("Your Google profile picture could not be loaded.");
                  }
                }}
              />
            ) : (
              <Avatar
                user={{
                  id: user?.id ?? null,
                  email: user?.email ?? null,
                  displayName: displayName || user?.displayName || user?.name || null,
                  name: user?.name ?? null,
                  image: user?.image ?? null,
                }}
                size="lg"
                className="settings-avatar-img"
              />
            )}
          </div>
          <div className="settings-avatar-info">
            <h3>{previewName || "MO Student"}</h3>
            <p className="settings-role-badge">{user.role}</p>
          </div>
        </div>

        <div className="settings-stats-row">
          <div>
            <strong>{user.stats?.attemptedSets ?? 0}</strong>
            <span>Sets tried</span>
          </div>
          <div>
            <strong>{user.stats?.averageScore ?? 0}%</strong>
            <span>Average</span>
          </div>
          <div>
            <strong>{user.stats?.practiceScore ?? 0}</strong>
            <span>Practice</span>
          </div>
          <div>
            <strong>{user.stats?.totalAttempts ?? 0}</strong>
            <span>Attempts</span>
          </div>
        </div>

        <div className="settings-form">
          <div className="settings-row">
            <label>
              <User size={14} />
              Username (email)
            </label>
            <input type="text" value={user.email} readOnly className="settings-readonly" />
            <small className="form-hint">Your username cannot be changed.</small>
          </div>

          <div className="settings-row">
            <label>
              <User size={14} />
              Real name
            </label>
            <input type="text" value={user.name || "—"} readOnly className="settings-readonly" />
            <small className="form-hint">
              You can only change your name by contacting the admin.
            </small>
          </div>

          <div className="settings-row">
            <label>Display name</label>
            <input
              type="text"
              placeholder="Enter a display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
            <small className="form-hint">
              This is shown in greetings, leaderboards, and your profile. Max 50 characters.
            </small>
          </div>

          <div className="settings-row">
            <label>Profile picture</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => handleAvatarFile(e.target.files?.[0])}
            />
            <small className="form-hint">Upload an image under 512 KB.</small>
          </div>

          <div className="settings-row">
            <label>Profile picture URL</label>
            <input
              type="url"
              placeholder="https://example.com/avatar.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <small className="form-hint">
              Paste a URL or leave this empty to use your Google profile picture when available.
            </small>
          </div>

          <div className="settings-row">
            <label>Theme</label>
            <div className="theme-choice" role="group" aria-label="Theme preference">
              <button
                className={`theme-choice-button ${themePreference === "light" ? "active" : ""}`}
                type="button"
                aria-pressed={themePreference === "light"}
                onClick={() => handleThemePreference("light")}
              >
                <Sun size={16} />
                Light
              </button>
              <button
                className={`theme-choice-button ${themePreference === "dark" ? "active" : ""}`}
                type="button"
                aria-pressed={themePreference === "dark"}
                onClick={() => handleThemePreference("dark")}
              >
                <Moon size={16} />
                Dark
              </button>
            </div>
            <small className="form-hint">Saved on this browser.</small>
          </div>

          <div className="settings-row">
            <label>Greeting Typing Speed (ms)</label>
            <input
              type="number"
              min="10"
              max="500"
              value={typewriterSettings.typeSpeed}
              onChange={(e) => setTypewriterSettings({ ...typewriterSettings, typeSpeed: Number(e.target.value) })}
              onBlur={(e) => setTypewriterSettings({ ...typewriterSettings, typeSpeed: Math.max(10, Math.min(500, Number(e.target.value) || 42)) })}
            />
            <small className="form-hint">Time between typing each character. Range: 10 - 500. Default: 42</small>
          </div>

          <div className="settings-row">
            <label>Greeting Deleting Speed (ms)</label>
            <input
              type="number"
              min="10"
              max="500"
              value={typewriterSettings.deleteSpeed}
              onChange={(e) => setTypewriterSettings({ ...typewriterSettings, deleteSpeed: Number(e.target.value) })}
              onBlur={(e) => setTypewriterSettings({ ...typewriterSettings, deleteSpeed: Math.max(10, Math.min(500, Number(e.target.value) || 22)) })}
            />
            <small className="form-hint">Time between deleting each character. Range: 10 - 500. Default: 22</small>
          </div>

          <div className="settings-row">
            <label>Greeting Hold Time (ms)</label>
            <input
              type="number"
              min="500"
              max="15000"
              value={typewriterSettings.holdMs}
              onChange={(e) => setTypewriterSettings({ ...typewriterSettings, holdMs: Number(e.target.value) })}
              onBlur={(e) => setTypewriterSettings({ ...typewriterSettings, holdMs: Math.max(500, Math.min(15000, Number(e.target.value) || 3676)) })}
            />
            <small className="form-hint">Read time before deleting. Range: 500 - 15000. Default: 3676</small>
          </div>

          <div className="settings-row">
            <label>Time Between Greetings (ms)</label>
            <input
              type="number"
              min="100"
              max="5000"
              value={typewriterSettings.betweenMs}
              onChange={(e) => setTypewriterSettings({ ...typewriterSettings, betweenMs: Number(e.target.value) })}
              onBlur={(e) => setTypewriterSettings({ ...typewriterSettings, betweenMs: Math.max(100, Math.min(5000, Number(e.target.value) || 280)) })}
            />
            <small className="form-hint">Pause before the next greeting starts. Range: 100 - 5000. Default: 280</small>
          </div>

          <div className="settings-row">
            <label>Privacy</label>
            <div className="settings-toggle-list">
              <label className="settings-toggle-row">
                <input
                  checked={profileVisible}
                  type="checkbox"
                  onChange={(event) => setProfileVisible(event.target.checked)}
                />
                <span>Show my public profile to other students</span>
              </label>
              <label className="settings-toggle-row">
                <input
                  checked={leaderboardVisible}
                  type="checkbox"
                  onChange={(event) => setLeaderboardVisible(event.target.checked)}
                />
                <span>Include me on leaderboards</span>
              </label>
            </div>
            <small className="form-hint">
              Teachers can still view training records for class management.
            </small>
          </div>

          {customAvatar ? (
            <button
              className="secondary-action compact settings-clear-avatar"
              type="button"
              onClick={() => setAvatarUrl("")}
            >
              Use Google/default avatar
            </button>
          ) : null}

          {user.group && (
            <div className="settings-row">
              <label>Group</label>
              <input type="text" value={user.group} readOnly className="settings-readonly" />
            </div>
          )}

          <button className="primary-action settings-save" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    </main>
  );
}
