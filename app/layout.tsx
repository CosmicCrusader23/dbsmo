import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DBSMO Training Platform",
  description: "Mathematics olympiad training platform for Diocesans Boys' School.",
  icons: {
    icon: "/logo.png",
  },
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
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
      <body className={inter.className}>
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
