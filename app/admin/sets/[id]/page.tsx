import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Hash } from "lucide-react";
import { prisma } from "@/lib/db";
import { statusLabel, statusColor } from "@/lib/visibility";
import { SetEditForm } from "./set-edit-form";

export const dynamic = "force-dynamic";

type SetDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SetDetailPage({ params }: SetDetailPageProps) {
  const { id } = await params;

  const set = await prisma.problemSet.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { number: "asc" } },
      problemFile: true,
      solutionFile: true,
    },
  });

  if (!set) {
    notFound();
  }

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
            <p className="eyebrow">
              <span className={`status-badge ${statusColor(set)}`}>{statusLabel(set)}</span>
            </p>
            <h1>{set.title}</h1>
          </div>
          <Link className="secondary-action" href="/admin/sets">
            <ArrowLeft size={18} />
            All sets
          </Link>
        </header>

        <section className="import-layout">
          {/* Left: metadata edit form */}
          <SetEditForm set={set} />

          {/* Right: problems list + file info */}
          <aside className="panel import-spec" style={{ paddingBottom: 20 }}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Answer key</p>
                <h2>
                  {set.problems.length} problem{set.problems.length !== 1 ? "s" : ""}
                </h2>
              </div>
              <Hash size={20} />
            </div>

            <div className="set-list">
              {set.problems.map((problem) => (
                <div className="set-row" key={problem.id}>
                  <div className="set-main">
                    <span className="problem-number">{problem.number}</span>
                    <div>
                      <strong>{problem.answerKey}</strong>
                      <small>
                        {problem.answerType.toLowerCase()} · {problem.points} pt
                        {problem.points !== 1 ? "s" : ""}
                      </small>
                    </div>
                  </div>
                  {problem.topicTags.length > 0 && (
                    <small className="topic-chips">{problem.topicTags.join(", ")}</small>
                  )}
                </div>
              ))}
            </div>

            {(set.problemFile || set.solutionFile) && (
              <div className="preview-files" style={{ padding: "0 20px 0" }}>
                {set.problemFile && (
                  <span>
                    <FileText size={14} /> {set.problemFile.originalName}
                  </span>
                )}
                {set.solutionFile && (
                  <span>
                    <FileText size={14} /> {set.solutionFile.originalName}
                  </span>
                )}
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
