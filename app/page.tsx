import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AuthButton } from "./auth-button";
import { authOptions, devBypassEnabled, googleAuthEnabled } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ThemeToggle } from "./theme-toggle";
import { CosmicStarfield } from "./cosmic-starfield";

export const dynamic = "force-dynamic";

type LandingPageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const [session, query] = await Promise.all([getServerSession(authOptions), searchParams]);
  const callbackUrl = safeRedirectPath(query.redirect);

  if (session) {
    redirect(callbackUrl);
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
              callbackUrl={callbackUrl}
              mode="stacked"
              session={session}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
