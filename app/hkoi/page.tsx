import { ArrowUpRight, BookOpen, Timer } from "lucide-react";
import styles from "./page.module.css";

const activities = [
  {
    title: "Timed practice",
    description:
      "Try a set of HKOI Heat questions at contest pace and check your results as you go.",
    href: "/hkoi/HKOI%E5%88%9D%E8%B3%BD%E9%99%90%E6%99%82%E7%B7%B4%E7%BF%92.html",
    label: "Start practice",
    Icon: Timer,
  },
  {
    title: "Key question review",
    description:
      "Browse selected questions by topic with answers, explanations, and related past papers.",
    href: "/hkoi/HKOI%20%E5%88%9D%E8%B3%BD%E9%87%8D%E9%BB%9E%E9%A1%8C%E8%A7%A3.html",
    label: "Browse explanations",
    Icon: BookOpen,
  },
];

export default function HkoiPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Hong Kong Olympiad in Informatics</span>
        <h1>HKOI</h1>
        <p>Practice for the HKOI Heat or review explanations for selected questions.</p>
      </header>

      <nav className={styles.grid} aria-label="HKOI study materials">
        {activities.map(({ title, description, href, label, Icon }) => (
          <a className={styles.card} href={href} key={title} rel="noreferrer" target="_blank">
            <span className={styles.icon} aria-hidden="true">
              <Icon size={22} />
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className={styles.action}>
              {label}
              <ArrowUpRight aria-hidden="true" size={17} />
            </span>
          </a>
        ))}
      </nav>
    </main>
  );
}
