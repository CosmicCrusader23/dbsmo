"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

type Role = "STUDENT" | "TEACHER" | "CONTENT_EDITOR" | "ANALYST" | "ADMIN";

const ROLE_OPTIONS: Role[] = ["STUDENT", "TEACHER", "CONTENT_EDITOR", "ANALYST", "ADMIN"];

export function PromoteUserButton({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(role: Role) {
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
        setError(body.error ?? "Could not update role.");
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
      <label className="role-select-control">
        <span>Role</span>
        <select
          disabled={isSaving}
          value={currentRole}
          onChange={(event) => updateRole(event.target.value as Role)}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      {isSaving ? <MathCurveLoader size={16} label="Saving role" /> : <ShieldCheck size={16} />}
      {error ? <span className="form-error">{error}</span> : null}
    </div>
  );
}
