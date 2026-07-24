import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { FileJson } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { JsonZipImportPanel } from "./json-zip-import-panel";
import { ZipImportPanel } from "./zip-import-panel";
import { PageBackLink } from "@/app/page-back-link";

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:content")) redirect("/dashboard");

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
          <PageBackLink destination="Dashboard" href="/dashboard" />
        </header>

        <section className="import-layout">
          <div className="import-stack">
            <ZipImportPanel />
            <JsonZipImportPanel />
          </div>

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
  "statementFormat": "LATEX",
  "status": "DRAFT",
  "topicTags": ["Algebra"],
  "images": [
    { "key": "fig1", "mimeType": "image/png", "data": "<base64>" }
  ],
  "problems": [
    {
      "number": 1,
      "statement": "See [[img:fig1]]. Find $\\\\sqrt{2}$.",
      "answerType": "EXPRESSION",
      "answerKey": "sqrt(2)",
      "acceptedAnswers": ["2^0.5"],
      "solution": "$\\\\sqrt{2}=2^{1/2}$."
    }
  ]
}`}</pre>
            <div className="check-list">
              <span>Schema validation</span>
              <span>LaTeX or HTML statements</span>
              <span>Inline images via [[img:KEY]]</span>
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
