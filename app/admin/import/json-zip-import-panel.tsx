"use client";

import JSZip from "jszip";
import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileArchive,
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
    statementFormat?: string;
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

type JsonZipEntry = {
  name: string;
  file: File;
};

export function JsonZipImportPanel() {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<JsonZipEntry[]>([]);
  const [zipError, setZipError] = useState<string | null>(null);
  const [isReadingZip, setIsReadingZip] = useState(false);

  const [dryRunResults, setDryRunResults] = useState<Record<string, DryRunResult | null>>({});
  const [dryRunErrors, setDryRunErrors] = useState<Record<string, string | null>>({});
  const [isDryRunning, setIsDryRunning] = useState<Record<string, boolean>>({});

  const [importResults, setImportResults] = useState<Record<string, ImportResult | null>>({});
  const [importErrors, setImportErrors] = useState<Record<string, string | null>>({});
  const [isImporting, setIsImporting] = useState<Record<string, boolean>>({});

  const validation = useMemo(() => {
    if (!zipFile) {
      return [
        { label: "ZIP selected", ok: false },
        { label: "Only .json files inside", ok: false },
        { label: "Ready to process individually", ok: false },
      ];
    }

    const isZip =
      zipFile.name.toLowerCase().endsWith(".zip") || zipFile.type === "application/zip";
    const hasOnlyJson = entries.length > 0 && !zipError;

    return [
      { label: "ZIP selected", ok: isZip },
      { label: "Only .json files inside", ok: Boolean(hasOnlyJson) },
      { label: "Ready to process individually", ok: Boolean(isZip && hasOnlyJson) },
    ];
  }, [entries.length, zipError, zipFile]);

  async function onZipChange(event: ChangeEvent<HTMLInputElement>) {
    const nextZip = event.target.files?.[0] ?? null;
    setZipFile(nextZip);
    setEntries([]);
    setZipError(null);
    setDryRunResults({});
    setDryRunErrors({});
    setImportResults({});
    setImportErrors({});

    if (!nextZip) {
      return;
    }

    const isZip =
      nextZip.name.toLowerCase().endsWith(".zip") || nextZip.type === "application/zip";
    if (!isZip) {
      setZipError("Please upload a .zip archive.");
      return;
    }

    setIsReadingZip(true);
    try {
      const zip = await JSZip.loadAsync(await nextZip.arrayBuffer());
      const files = Object.values(zip.files).filter((entry) => !entry.dir);
      const invalidFiles = files.filter((entry) => !entry.name.toLowerCase().endsWith(".json"));

      if (invalidFiles.length > 0) {
        setZipError("ZIP archives here may only contain .json files.");
        return;
      }

      if (files.length === 0) {
        setZipError("This ZIP does not contain any .json files.");
        return;
      }

      const jsonEntries = await Promise.all(
        files
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (entry) => {
            const content = await entry.async("uint8array");
            const bytes = new Uint8Array(content.byteLength);
            bytes.set(content);
            return {
              name: entry.name,
              file: new File([bytes], entry.name.split("/").pop() || entry.name, {
                type: "application/json",
              }),
            };
          }),
      );

      setEntries(jsonEntries);
    } catch {
      setZipError("Could not read that ZIP archive.");
    } finally {
      setIsReadingZip(false);
    }
  }

  async function onDryRun(entry: JsonZipEntry) {
    const formData = new FormData();
    formData.append("file", entry.file);
    setIsDryRunning((current) => ({ ...current, [entry.name]: true }));
    setDryRunErrors((current) => ({ ...current, [entry.name]: null }));
    setDryRunResults((current) => ({ ...current, [entry.name]: null }));
    setImportResults((current) => ({ ...current, [entry.name]: null }));
    setImportErrors((current) => ({ ...current, [entry.name]: null }));

    try {
      const response = await fetch("/api/admin/import/dry-run", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as DryRunResult;
      setDryRunResults((current) => ({ ...current, [entry.name]: result }));
      if (!response.ok) {
        setDryRunErrors((current) => ({
          ...current,
          [entry.name]: result.issues[0]?.message ?? "Dry run failed.",
        }));
      }
    } catch {
      setDryRunErrors((current) => ({ ...current, [entry.name]: "Dry run request failed." }));
    } finally {
      setIsDryRunning((current) => ({ ...current, [entry.name]: false }));
    }
  }

  async function onImport(entry: JsonZipEntry) {
    const formData = new FormData();
    formData.append("file", entry.file);
    setIsImporting((current) => ({ ...current, [entry.name]: true }));
    setImportErrors((current) => ({ ...current, [entry.name]: null }));
    setImportResults((current) => ({ ...current, [entry.name]: null }));

    try {
      const response = await fetch("/api/admin/import/commit", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ImportResult;
      setImportResults((current) => ({ ...current, [entry.name]: result }));
      if (!response.ok && !result.ok) {
        setImportErrors((current) => ({
          ...current,
          [entry.name]: result.issues[0]?.message ?? "Import failed.",
        }));
      }
    } catch {
      setImportErrors((current) => ({ ...current, [entry.name]: "Import request failed." }));
    } finally {
      setIsImporting((current) => ({ ...current, [entry.name]: false }));
    }
  }

  return (
    <section className="panel import-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Batch uploader</p>
          <h2>ZIP of JSON files</h2>
        </div>
        <FileArchive size={22} />
      </div>

      <label className="dropzone">
        <input
          type="file"
          accept=".zip,application/zip"
          data-testid="json-zip-file-input"
          onChange={onZipChange}
        />
        <UploadCloud size={34} />
        <strong>{zipFile ? zipFile.name : "Choose ZIP archive"}</strong>
        <span>
          {zipFile
            ? `${formatBytes(zipFile.size)} selected`
            : "Upload a ZIP that contains only valid .json files"}
        </span>
      </label>

      <div className="validation-list" aria-label="ZIP validation preview">
        {validation.map((item) => (
          <div className={`validation-row ${item.ok ? "ok" : "fail"}`} key={item.label}>
            {item.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {zipError ? (
        <div className="dry-run-result" aria-live="polite">
          <p className="result-error">{zipError}</p>
        </div>
      ) : null}

      {isReadingZip ? (
        <div className="dry-run-result" aria-live="polite">
          <div className="issue-row ok">
            <Loader2 size={16} className="spin-icon" />
            <span>Reading ZIP archive…</span>
          </div>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="zip-json-list">
          {entries.map((entry) => {
            const dryRunResult = dryRunResults[entry.name];
            const importResult = importResults[entry.name];
            const canImport = dryRunResult?.ok === true && !importResult?.ok;

            return (
              <article className="zip-json-item" key={entry.name}>
                <div className="zip-json-row">
                  <div className="zip-json-meta">
                    <strong>{entry.name}</strong>
                    <small>{formatBytes(entry.file.size)}</small>
                  </div>
                  <div className="topbar-actions">
                    <button
                      className="secondary-action compact"
                      type="button"
                      disabled={isDryRunning[entry.name] === true}
                      onClick={() => onDryRun(entry)}
                    >
                      <ShieldCheck size={16} />
                      {isDryRunning[entry.name] ? "Checking…" : "Dry run"}
                    </button>
                    <button
                      className="primary-action compact"
                      type="button"
                      disabled={!canImport || isImporting[entry.name] === true}
                      onClick={() => onImport(entry)}
                    >
                      {isImporting[entry.name] ? (
                        <Loader2 size={16} className="spin-icon" />
                      ) : (
                        <UploadCloud size={16} />
                      )}
                      {isImporting[entry.name] ? "Importing…" : "Import"}
                    </button>
                  </div>
                </div>

                {importResult?.ok && importResult.created ? (
                  <div className="dry-run-result" aria-live="polite">
                    <div className="import-result-card">
                      <div className="result-header">
                        <CheckCircle2 size={22} />
                        <div>
                          <strong>Import successful</strong>
                          <small>{importResult.created.title}</small>
                        </div>
                      </div>
                      <div className="result-links">
                        <Link
                          className="secondary-action compact"
                          href={`/admin/sets/${importResult.created.problemSetId}`}
                        >
                          <ExternalLink size={16} />
                          View draft
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!importResult && (dryRunErrors[entry.name] || dryRunResult) ? (
                  <div className="dry-run-result" aria-live="polite">
                    {dryRunErrors[entry.name] ? (
                      <p className="result-error">{dryRunErrors[entry.name]}</p>
                    ) : null}
                    {dryRunResult?.preview ? (
                      <div className="preview-card">
                        <div className="preview-heading">
                          <span
                            className={`status-dot ${
                              dryRunResult.ok ? "status-solved" : "status-review"
                            }`}
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
                          <div className={`issue-row ${issue.level}`} key={`${entry.name}-${issue.message}`}>
                            {issue.level === "error" ? (
                              <XCircle size={16} />
                            ) : (
                              <ShieldCheck size={16} />
                            )}
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : dryRunResult ? (
                      <div className="issue-row ok">
                        <CheckCircle2 size={16} />
                        <span>Dry run passed. Ready to import this JSON file.</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {importErrors[entry.name] ? (
                  <div className="dry-run-result" aria-live="polite">
                    <p className="result-error">{importErrors[entry.name]}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
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
