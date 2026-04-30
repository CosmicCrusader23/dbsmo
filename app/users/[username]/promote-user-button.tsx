"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export function PromoteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promote() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN" }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Could not promote user.");
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
      <button className="primary-action" type="button" disabled={isSaving} onClick={promote}>
        <ShieldCheck size={16} />
        {isSaving ? "Promoting..." : "Promote to admin"}
      </button>
      {error ? <span className="form-error">{error}</span> : null}
    </div>
  );
}
