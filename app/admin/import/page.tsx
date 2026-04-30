import Link from "next/link";
import { ArrowLeft, FileJson } from "lucide-react";
import { ZipImportPanel } from "./zip-import-panel";

export default function ImportPage() {
  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-one" />
      </div>

      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>JSON Import</h1>
          </div>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={18} />
            Dashboard
          </Link>
        </header>

        <section className="import-layout">
          <ZipImportPanel />

          <aside className="panel import-spec">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Schema</p>
                <h2>Expected JSON</h2>
              </div>
              <FileJson size={20} />
            </div>
            <pre aria-label="Expected JSON structure">{`{
  "slug": "mo-set-001",
  "title": "Algebra Basics",
  "status": "DRAFT",
  "topicTags": ["Algebra"],
  "problems": [
    {
      "number": 1,
      "statement": "Find $x$ if $x^2=4$.",
      "answerType": "INTEGER",
      "answerKey": "2",
      "acceptedAnswers": ["-2"],
      "solution": "$x=\\\\pm2$."
    }
  ]
}`}</pre>
            <div className="check-list">
              <span>Schema validation</span>
              <span>LaTeX statements</span>
              <span>Answer type preview</span>
              <span>Draft before publish</span>
              <span>Solutions stored as notes</span>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
