import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DBS MO Training",
  description: "Mathematics olympiad training platform for answer-only problem sets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body>
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
        {children}
      </body>
    </html>
  );
}
