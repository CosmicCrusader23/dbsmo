import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Music2, ShieldCheck, Sparkles } from "lucide-react";
import { AuthButton } from "./auth-button";
import { authOptions, googleAuthEnabled } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-shell">
      <div className="login-stage">
        <header className="login-topbar">
          <Link className="brand login-brand" href="/">
            <span className="brand-mark">
              <img src="/logo.png" alt="MO Logo" />
            </span>
            <span>
              <strong>DBSMO Training</strong>
              <small>sign in to continue</small>
            </span>
          </Link>
          <ThemeToggle />
        </header>

        <div className="login-layout">
          <section className="login-copy">
            <p className="eyebrow">DBS Mathematics Olympiad</p>
            <h1>sign in to proceed.</h1>
            <p className="login-copy-text">
              math olympiad sandbox.
            </p>
          </section>

          <aside className="login-card" data-testid="login-card">
            <div className="login-card-head">
              <p className="eyebrow">sign in</p>
              <h2>DBS Training</h2>
            </div>

            <AuthButton
              canUseGoogle={googleAuthEnabled}
              mode="stacked"
              session={session}
            />

            <div className="landing-footnote">
              <ShieldCheck size={16} />
              <span>Only DBS school accounts are allowed in the real deployment.</span>
            </div>
            <div className="landing-footnote">
              <Sparkles size={16} />
              <span>Developer bypass stays local and is meant only for testing.</span>
            </div>
          </aside>
        </div>

        <div className="login-note">
          <Music2 size={16} />
          <span>made with love with codex and claude code © 2026 Cosmic Crusader</span>
        </div>
      </div>
    </main>
  );
}
