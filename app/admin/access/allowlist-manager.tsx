"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Entry = {
  id: string;
  kind: "EMAIL" | "DOMAIN";
  value: string;
  source: "built-in" | "environment" | "admin";
  deletable: boolean;
};

export function AllowlistManager() {
  const router = useRouter();
  const [kind, setKind] = useState<Entry["kind"]>("EMAIL");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not add the allowlist entry.");
        return;
      }
      setValue("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={addEntry} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
      <select
        aria-label="Allowlist entry type"
        className="student-filter-select"
        onChange={(event) => setKind(event.target.value as Entry["kind"])}
        value={kind}
      >
        <option value="EMAIL">Email address</option>
        <option value="DOMAIN">Domain</option>
      </select>
      <input
        aria-label={kind === "EMAIL" ? "Email address" : "Domain"}
        autoComplete="off"
        className="student-filter-select"
        onChange={(event) => setValue(event.target.value)}
        placeholder={kind === "EMAIL" ? "name@example.com" : "example.com"}
        required
        style={{ flex: "1 1 280px" }}
        type={kind === "EMAIL" ? "email" : "text"}
        value={value}
      />
      <button className="primary-action" disabled={saving} type="submit">
        {saving ? "Adding…" : "Add to whitelist"}
      </button>
      {error ? (
        <p role="alert" style={{ flexBasis: "100%", color: "var(--color-danger, #b42318)" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveAllowlistEntryButton({ entryId, value }: { entryId: string; value: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function removeEntry() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/access/${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not remove the allowlist entry.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        className="secondary-action compact"
        disabled={saving}
        onClick={removeEntry}
        type="button"
      >
        {saving ? "Removing…" : `Remove ${value}`}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
