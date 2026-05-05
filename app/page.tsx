import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Music2 } from "lucide-react";
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
            <p className="eyebrow">Diocesan Boys&apos; School Mathematics Olympiad</p>
            <h1>sign in to proceed.</h1>
            <p className="login-copy-text">math olympiad training platform.</p>
          </section>

          <aside className="login-card" data-testid="login-card">
            <div className="login-card-head">
              <p className="eyebrow">sign in</p>
              <h2>with your school gmail</h2>
            </div>

            <AuthButton canUseGoogle={googleAuthEnabled} mode="stacked" session={session} />
          </aside>
        </div>

        <div className="login-note">
          <Music2 size={24} />
          <span>made with love with codex and claude code © 2026 Cosmic Crusader</span>
        </div>
      </div>
    </main>
  );
}
