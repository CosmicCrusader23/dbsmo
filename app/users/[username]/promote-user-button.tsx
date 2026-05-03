"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export function PromoteUserButton({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: "ADMIN" | "STUDENT";
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(role: "ADMIN" | "STUDENT") {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(
          body.error ?? (role === "ADMIN" ? "Could not promote user." : "Could not demote user."),
        );
        return;
      }

      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="profile-admin-actions">
      {currentRole === "STUDENT" ? (
        <button
          className="primary-action"
          type="button"
          disabled={isSaving}
          onClick={() => updateRole("ADMIN")}
        >
          <ShieldCheck size={16} />
          {isSaving ? "Promoting..." : "Promote to admin"}
        </button>
      ) : (
        <button
          className="secondary-action"
          type="button"
          disabled={isSaving}
          onClick={() => updateRole("STUDENT")}
        >
          <ShieldAlert size={16} />
          {isSaving ? "Demoting..." : "Demote admin"}
        </button>
      )}
      {error ? <span className="form-error">{error}</span> : null}
    </div>
  );
}
