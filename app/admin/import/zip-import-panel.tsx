"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileJson,
  Loader2,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

type ValidationItem = {
  label: string;
  ok: boolean;
};

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

export function ZipImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const validation = useMemo<ValidationItem[]>(() => {
    if (!file) {
      return [
        { label: "JSON selected", ok: false },
        { label: "Size under configured limit", ok: false },
        { label: "Ready for dry run", ok: false },
      ];
    }

    const isJson =
      file.name.toLowerCase().endsWith(".json") ||
      file.type === "application/json" ||
      file.type === "text/json";

    return [
      { label: "JSON selected", ok: isJson },
      { label: "Size under configured limit", ok: file.size <= 5 * 1024 * 1024 },
      { label: "Ready for dry run", ok: isJson },
    ];
  }, [file]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setDryRunResult(null);
    setDryRunError(null);
    setImportResult(null);
    setImportError(null);
  }

  const ready = validation.every((item) => item.ok);
  const canImport = dryRunResult?.ok === true && !importResult?.ok;

  async function onDryRun() {
    if (!file || !ready) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsDryRunning(true);
    setDryRunError(null);
    setDryRunResult(null);
    setImportResult(null);
    setImportError(null);

    try {
      const response = await fetch("/api/admin/import/dry-run", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as DryRunResult;
      setDryRunResult(result);
      if (!response.ok) {
        setDryRunError(result.issues[0]?.message ?? "Dry run failed.");
      }
    } catch {
      setDryRunError("Dry run request failed.");
    } finally {
      setIsDryRunning(false);
    }
  }

  async function onImport() {
    if (!file || !canImport) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const response = await fetch("/api/admin/import/commit", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ImportResult;
      setImportResult(result);
      if (!response.ok && !result.ok) {
        setImportError(result.issues[0]?.message ?? "Import failed.");
      }
    } catch {
      setImportError("Import request failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="panel import-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Uploader</p>
          <h2>JSON problem-set upload</h2>
        </div>
        <FileJson size={22} />
      </div>

      <label className="dropzone">
        <input
          type="file"
          accept=".json,application/json"
          data-testid="json-file-input"
          onChange={onFileChange}
        />
        <UploadCloud size={34} />
        <strong>{file ? file.name : "Choose JSON file"}</strong>
        <span>
          {file
            ? `${formatBytes(file.size)} selected`
            : "LaTeX statements, answer keys, answer types, tags, and solution notes"}
        </span>
      </label>

      <div className="validation-list" aria-label="Validation preview">
        {validation.map((item) => (
          <div className={`validation-row ${item.ok ? "ok" : "fail"}`} key={item.label}>
            {item.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="import-actions">
        <button
          className="secondary-action"
          type="button"
          disabled={!ready || isDryRunning}
          onClick={onDryRun}
        >
          <ShieldCheck size={18} />
          {isDryRunning ? "Checking…" : "Dry run"}
        </button>
        <button
          className="primary-action"
          type="button"
          disabled={!canImport || isImporting}
          onClick={onImport}
        >
          {isImporting ? <Loader2 size={18} className="spin-icon" /> : null}
          {isImporting ? "Importing…" : "Import JSON"}
          {!isImporting && <UploadCloud size={18} />}
        </button>
      </div>

      {/* ── Import result ────────────────────────────────── */}
      {importResult?.ok && importResult.created && (
        <div className="import-result-card" aria-live="polite">
          <div className="result-header">
            <CheckCircle2 size={22} />
            <div>
              <strong>Import successful</strong>
              <small>{importResult.created.title}</small>
            </div>
          </div>
          <dl className="preview-grid">
            <div>
              <dt>Slug</dt>
              <dd>{importResult.created.slug}</dd>
            </div>
            <div>
              <dt>Problems</dt>
              <dd>{importResult.created.problemCount}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{importResult.created.status}</dd>
            </div>
            <div>
              <dt>Files</dt>
              <dd>Inline JSON</dd>
            </div>
          </dl>
          <div className="result-links">
            <Link
              className="secondary-action compact"
              href={`/admin/sets/${importResult.created.problemSetId}`}
            >
              <ExternalLink size={16} />
              View draft
            </Link>
            <Link className="secondary-action compact" href="/admin/sets">
              All sets
            </Link>
          </div>
          {importResult.created.warnings.length > 0 && (
            <div className="issue-list">
              {importResult.created.warnings.map((w) => (
                <div className="issue-row warning" key={w}>
                  <ShieldCheck size={16} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {importError && (
        <div className="dry-run-result" aria-live="polite">
          <p className="result-error">{importError}</p>
          {importResult?.issues.map((issue) => (
            <div className={`issue-row ${issue.level}`} key={issue.message}>
              <XCircle size={16} />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Dry-run result ───────────────────────────────── */}
      {!importResult && (dryRunError || dryRunResult) && (
        <div className="dry-run-result" aria-live="polite">
          {dryRunError && <p className="result-error">{dryRunError}</p>}
          {dryRunResult?.preview && (
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
              <div className="preview-files">
                <span>{dryRunResult.preview.topicTags.join(", ") || "No tags"}</span>
                <span>{Object.keys(dryRunResult.preview.answerTypeCounts).join(", ")}</span>
                <span>{dryRunResult.preview.videoUrl ?? "No video"}</span>
              </div>
            </div>
          )}
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
              <span>Dry run passed. Ready to import from JSON.</span>
            </div>
          ) : null}
        </div>
      )}
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
