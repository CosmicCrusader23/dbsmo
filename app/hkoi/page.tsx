import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { authOptions } from "@/lib/auth";
import styles from "./page.module.css";

export default async function HkoiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Hong Kong Olympiad in Informatics</span>
        <h1>HKOI</h1>
        <p>Open the HKOI study page to start practice or review selected questions.</p>
      </header>

      <nav className={styles.grid} aria-label="HKOI study materials">
        <a
          className={styles.card}
          href="/hkoi/material/index.html"
          rel="noreferrer"
          target="_blank"
        >
          <span className={styles.icon} aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <h2>HKOI study materials</h2>
          <p>Choose timed practice or browse the selected question explanations.</p>
          <span className={styles.action}>
            Open HKOI
            <ArrowUpRight aria-hidden="true" size={17} />
          </span>
        </a>
      </nav>
    </main>
  );
}
