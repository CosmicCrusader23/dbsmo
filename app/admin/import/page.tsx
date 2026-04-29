import Link from "next/link";
import { ArrowLeft, FileArchive } from "lucide-react";
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
            <h1>ZIP Import</h1>
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
                <p className="eyebrow">Manifest</p>
                <h2>Expected archive</h2>
              </div>
              <FileArchive size={20} />
            </div>
            <pre aria-label="Expected ZIP structure">{`mo-set-001.zip
  manifest.yml
  problems.pdf
  solution.pdf
  answers.csv
  assets/
    diagram-01.png`}</pre>
            <div className="check-list">
              <span>Schema validation</span>
              <span>Answer key preview</span>
              <span>Draft before publish</span>
              <span>Rollback on failure</span>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
