"use client";

/* eslint-disable @next/next/no-img-element */

import type { Session } from "next-auth";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";

type AuthButtonProps = {
  session: Session | null;
  canUseBypass?: boolean;
  canUseGoogle?: boolean;
  mode?: "inline" | "stacked";
  profileHref?: string;
  avatarUrl?: string | null;
  displayName?: string | null;
};

export function AuthButton({
  session,
  canUseBypass = false,
  canUseGoogle = true,
  mode = "inline",
  profileHref,
  avatarUrl,
  displayName,
}: AuthButtonProps) {
  if (session) {
    const label = displayName || session.user?.name || session.user?.email;

    return (
      <div className="auth-session">
        {profileHref ? (
          <Link className="account-avatar-button" href={profileHref} aria-label="Open profile">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="account-avatar-img" />
            ) : (
              <span className="account-avatar-fallback">M</span>
            )}
          </Link>
        ) : null}
        <span className="session-badge">
          {label} ({session.user?.role})
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
        {canUseGoogle ? "sign in with school Google" : "Google sign-in unavailable"}
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
