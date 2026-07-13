import type { Metadata, Viewport } from "next";
import { Inter, Shantell_Sans } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { SiteSidebar } from "./site-sidebar";
import { GlobalMobileNavToggle } from "./global-mobile-nav";
import { AppFooter } from "./app-footer";
import { AnimeRouteEffects } from "./anime-route-effects";

export const metadata: Metadata = {
  title: "DBSMO Training Platform",
  description: "Mathematics olympiad training platform for Diocesans Boys' School.",
  icons: {
    icon: "/dbsmo-mark.svg",
    apple: "/dbsmo-mark.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const shantellSans = Shantell_Sans({
  subsets: ["latin"],
  variable: "--font-shantell",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sidebar = await SiteSidebar();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${shantellSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('mo-theme') || 'light';
                document.documentElement.classList.add(theme);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className}${sidebar ? " has-site-sidebar" : ""}`}>
        <div className="confetti-triangles" aria-hidden="true">
          <span className="tri-1" />
          <span className="tri-2" />
          <span className="tri-3" />
          <span className="tri-4" />
          <span className="tri-5" />
          <span className="tri-6" />
          <span className="tri-7" />
          <span className="tri-8" />
          <span className="tri-9" />
          <span className="tri-10" />
          <span className="tri-11" />
          <span className="tri-12" />
        </div>
        {sidebar}
        {sidebar ? <GlobalMobileNavToggle /> : null}
        <AnimeRouteEffects />
        <div className="site-content">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
