import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AuthButton } from "./auth-button";
import { authOptions, devBypassEnabled, googleAuthEnabled } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { CosmicStarfield } from "./cosmic-starfield";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-shell">
      <CosmicStarfield variant="sol" />
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
          <ThemeToggle persist={false} />
        </header>

        <div className="login-layout">
          <section className="login-copy">
            <p className="cosmic-kicker">A place to think further <span>✦</span></p>
            <h1>sign in to proceed.</h1>
            <p className="login-copy-text">Diocesan Boys&apos; School math olympiad training.</p>
          </section>

          <aside className="login-card" data-testid="login-card">
            <div className="login-card-head">
              <p className="cosmic-card-index">DBSMO / 01</p>
              <h2>sign in with your school gmail</h2>
              <p>Pick up where your curiosity left off.</p>
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
