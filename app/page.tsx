import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AuthButton } from "./auth-button";
import { authOptions, devBypassEnabled, googleAuthEnabled } from "@/lib/auth";
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
              <Image src="/dbsmo-mark.svg" alt="DBSMO" width={60} height={60} priority />
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
            <div className="login-math-sketch" aria-hidden="true">
              <span className="login-sketch-glyph login-sketch-pi">π</span>
              <span className="login-sketch-glyph login-sketch-sum">∑</span>
              <span className="login-sketch-glyph login-sketch-root">√</span>
              <span className="login-sketch-orbit" />
              <span className="login-sketch-axis" />
              <span className="login-sketch-point point-one" />
              <span className="login-sketch-point point-two" />
              <span className="login-sketch-point point-three" />
            </div>
            <h1>sign in to proceed.</h1>
            <p className="login-copy-text">Diocesan Boys&apos; School math olympiad training.</p>
          </section>

          <aside className="login-card" data-testid="login-card">
            <div className="login-card-head">
              <h2>sign in with your school gmail</h2>
            </div>

            <AuthButton
              canUseBypass={devBypassEnabled}
              canUseGoogle={googleAuthEnabled}
              mode="stacked"
              session={session}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
