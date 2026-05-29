import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";

export const metadata = { title: "404 · DBSMO" };

export default function NotFound() {
  return (
    <main className="notfound-shell" aria-labelledby="notfound-title">
      <div className="notfound-stage" aria-hidden="true">
        <div className="notfound-glyph notfound-glyph-bg">∮</div>
        <div className="notfound-digit notfound-digit-1">4</div>
        <div className="notfound-digit notfound-digit-zero" aria-hidden="true">
          <span className="notfound-zero-bracket">∮</span>
        </div>
        <div className="notfound-digit notfound-digit-2">4</div>
        <div className="notfound-glyph notfound-glyph-pi">π</div>
        <div className="notfound-glyph notfound-glyph-sum">Σ</div>
        <div className="notfound-glyph notfound-glyph-root">√</div>
        <div className="notfound-glyph notfound-glyph-infty">∞</div>
      </div>

      <h1 id="notfound-title" className="notfound-title">
        Undefined behaviour.
      </h1>
      <p className="notfound-sub">
        That page is not in our domain. Try a different one.
      </p>

      <div className="notfound-actions">
        <Link href="/" className="primary-action">
          <ArrowLeft size={16} /> Home
        </Link>
        <Link href="/dashboard" className="secondary-action">
          <RefreshCcw size={16} /> Dashboard
        </Link>
      </div>

      <p className="notfound-hint">
        <code>lim<sub>x→404</sub> route(x) = ∅</code>
      </p>
    </main>
  );
}
