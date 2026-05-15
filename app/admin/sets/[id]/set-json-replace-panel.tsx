"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileJson,
  Loader2,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

type DryRunResult = {
  ok: boolean;
  issues: Array<{
    level: "error" | "warning";
    message: string;
  }>;
  preview: null | {
    slug: string;
    title: string;
    status: string;
    problemCount: number;
    totalPoints: number;
    difficulty: number;
    topicTags: string[];
    videoUrl: string | null;
    statementFormat?: string;
    answerTypeCounts: Record<string, number>;
    solutionCount: number;
  };
};

type ImportResult = {
  ok: boolean;
  issues: Array<{
    level: "error" | "warning";
    message: string;
  }>;
  created: null | {
    problemSetId: string;
    slug: string;
    title: string;
    status: string;
    problemCount: number;
    problemFileKey: string | null;
    solutionFileKey: string | null;
    videoUrl: string | null;
    warnings: string[];
  };
};

export function SetJsonReplacePanel({ setId, setTitle }: { setId: string; setTitle: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setDryRunResult(null);
    setDryRunError(null);
    setImportResult(null);
    setImportError(null);
  }

  async function submit(intent: "dry-run" | "replace") {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("intent", intent);

    if (intent === "dry-run") {
      setIsDryRunning(true);
      setDryRunError(null);
      setDryRunResult(null);
      setImportResult(null);
      setImportError(null);
    } else {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);
    }

    try {
      const response = await fetch(`/api/admin/sets/${setId}/replace-json`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as DryRunResult | ImportResult;

      if (intent === "dry-run") {
        setDryRunResult(result as DryRunResult);
        if (!response.ok) {
          setDryRunError(
            (result as DryRunResult).issues[0]?.message ?? "Dry run failed for this JSON file.",
          );
        }
      } else {
        setImportResult(result as ImportResult);
        if (!response.ok) {
          setImportError(
            (result as ImportResult).issues[0]?.message ?? "Replacement failed for this JSON file.",
          );
        } else {
          router.refresh();
        }
      }
    } catch {
      if (intent === "dry-run") {
        setDryRunError("Dry run request failed.");
      } else {
        setImportError("Replacement request failed.");
      }
    } finally {
      if (intent === "dry-run") {
        setIsDryRunning(false);
      } else {
        setIsImporting(false);
      }
    }
  }

  async function onReplace() {
    if (!file || !dryRunResult?.ok) {
      return;
    }

    const confirmed = window.confirm(
      `Replace "${setTitle}" with "${file.name}"?\n\nThis deletes the current set, attempts, responses, bookmarks, and feedback before importing the new JSON.`,
    );

    if (!confirmed) {
      return;
    }

    await submit("replace");
  }

  const readyToReplace = dryRunResult?.ok === true && !importResult?.ok;

  return (
    <section className="json-replace-section">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Direct replace</p>
          <h2>Import JSON over this set</h2>
        </div>
        <FileJson size={20} />
      </div>

      <label className="dropzone">
        <input
          type="file"
          accept=".json,application/json"
          onChange={onFileChange}
          data-testid="replace-set-json-input"
        />
        <UploadCloud size={34} />
        <strong>{file ? file.name : "Choose JSON file"}</strong>
        <span>
          {file
            ? `${formatBytes(file.size)} selected`
            : "Dry run first, then replace this set in place if the JSON passes"}
        </span>
      </label>

      <div className="validation-list" aria-label="Replacement validation preview">
        <div className={`validation-row ${file ? "ok" : "fail"}`}>
          {file ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>JSON selected</span>
        </div>
        <div className={`validation-row ${dryRunResult?.ok ? "ok" : "fail"}`}>
          {dryRunResult?.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>Dry run passes</span>
        </div>
        <div className={`validation-row ${readyToReplace ? "ok" : "fail"}`}>
          {readyToReplace ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>Ready to replace current set</span>
        </div>
      </div>

      <div className="zip-json-list" style={{ marginTop: 0 }}>
        <article className="zip-json-item">
          <div className="zip-json-row">
            <div className="zip-json-meta">
              <strong>{setTitle}</strong>
              <small>Current set will be cleared before the replacement import commits.</small>
            </div>
            <div className="topbar-actions">
              <button
                className="secondary-action compact"
                type="button"
                disabled={!file || isDryRunning}
                onClick={() => void submit("dry-run")}
              >
                <ShieldCheck size={16} />
                {isDryRunning ? "Checking..." : "Dry run"}
              </button>
              <button
                className="primary-action compact"
                type="button"
                disabled={!readyToReplace || isImporting}
                onClick={() => void onReplace()}
              >
                {isImporting ? <Loader2 size={16} className="spin-icon" /> : <UploadCloud size={16} />}
                {isImporting ? "Replacing..." : "Replace set"}
              </button>
            </div>
          </div>

          {importResult?.ok && importResult.created ? (
            <div className="dry-run-result" aria-live="polite">
              <div className="import-result-card">
                <div className="result-header">
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>Replacement successful</strong>
                    <small>{importResult.created.title}</small>
                  </div>
                </div>
                <div className="result-links">
                  <Link
                    className="secondary-action compact"
                    href={`/admin/sets/${importResult.created.problemSetId}`}
                  >
                    <ExternalLink size={16} />
                    Refresh editor
                  </Link>
                  <Link
                    className="secondary-action compact"
                    href={`/problem-sets/${importResult.created.slug}`}
                  >
                    <ExternalLink size={16} />
                    Open set
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {!importResult && (dryRunError || dryRunResult) ? (
            <div className="dry-run-result" aria-live="polite">
              {dryRunError ? <p className="result-error">{dryRunError}</p> : null}
              {dryRunResult?.preview ? (
                <div className="preview-card">
                  <div className="preview-heading">
                    <span
                      className={`status-dot ${dryRunResult.ok ? "status-solved" : "status-review"}`}
                    />
                    <div>
                      <strong>{dryRunResult.preview.title}</strong>
                      <small>{dryRunResult.preview.slug}</small>
                    </div>
                  </div>
                  <dl className="preview-grid">
                    <div>
                      <dt>Problems</dt>
                      <dd>{dryRunResult.preview.problemCount}</dd>
                    </div>
                    <div>
                      <dt>Points</dt>
                      <dd>{dryRunResult.preview.totalPoints}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{dryRunResult.preview.status}</dd>
                    </div>
                    <div>
                      <dt>Solutions</dt>
                      <dd>{dryRunResult.preview.solutionCount}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {dryRunResult?.issues.length ? (
                <div className="issue-list">
                  {dryRunResult.issues.map((issue) => (
                    <div className={`issue-row ${issue.level}`} key={issue.message}>
                      {issue.level === "error" ? <XCircle size={16} /> : <ShieldCheck size={16} />}
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              ) : dryRunResult ? (
                <div className="issue-row ok">
                  <CheckCircle2 size={16} />
                  <span>Dry run passed. Replacing this set will now use the uploaded JSON.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {importError ? (
            <div className="dry-run-result" aria-live="polite">
              <p className="result-error">{importError}</p>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
