"use client";

import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";

type AuthButtonProps = {
  session: Session | null;
  canUseBypass?: boolean;
  canUseGoogle?: boolean;
  mode?: "inline" | "stacked";
};

export function AuthButton({
  session,
  canUseBypass = false,
  canUseGoogle = true,
  mode = "inline",
}: AuthButtonProps) {
  if (session) {
    return (
      <div className="auth-session">
        <span className="session-badge">
          {session.user?.name || session.user?.email} ({session.user?.role})
        </span>
        <button
          className="secondary-action compact"
          data-testid="signout-button"
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          sign out
        </button>
      </div>
    );
  }

  return (
    <div className={`auth-actions auth-actions-${mode}`}>
      <button
        className="primary-action auth-cta"
        data-testid="google-signin-button"
        type="button"
        disabled={!canUseGoogle}
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      >
        {canUseGoogle ? "sign in with school google" : "school google unavailable in local dev"}
      </button>

      {canUseBypass ? (
        <div className="bypass-group">
          <button
            className="secondary-action compact auth-bypass"
            data-testid="bypass-student-button"
            type="button"
            onClick={() => signIn("credentials", { role: "STUDENT", callbackUrl: "/dashboard" })}
          >
            bypass as student
          </button>
          <button
            className="secondary-action compact auth-bypass"
            data-testid="bypass-admin-button"
            type="button"
            onClick={() => signIn("credentials", { role: "ADMIN", callbackUrl: "/dashboard" })}
          >
            bypass as admin
          </button>
        </div>
      ) : null}
    </div>
  );
}
