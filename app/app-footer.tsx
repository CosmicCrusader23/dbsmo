import { Code2, Globe2 } from "lucide-react";
import { APP_VERSION } from "@/lib/app-version";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <span>© 2026 Cosmic Crusader</span>
      <span>{APP_VERSION}</span>
      <span>made with ❤️ with codex and claude code</span>
      <a
        aria-label="GitHub repository"
        href="https://github.com/CosmicCrusader23/dbsmo"
        rel="noreferrer"
        target="_blank"
      >
        <Code2 size={16} />
      </a>
      <a aria-label="Cosmic website" href="https://mycosmic.dev/" rel="noreferrer" target="_blank">
        <Globe2 size={16} />
      </a>
    </footer>
  );
}
