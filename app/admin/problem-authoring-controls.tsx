"use client";

import { useState } from "react";
import { Braces, ImageIcon, Plus, Trash2 } from "lucide-react";
import { LatexStatement } from "@/app/problem-sets/[slug]/latex-statement";
import { MathCurveLoader } from "@/app/math-curve-loader";

export type AuthoringImageAsset = {
  key: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

export function AsymptoteAuthoringControl({
  onRendered,
}: {
  onRendered: (asset: AuthoringImageAsset) => void;
}) {
  const [source, setSource] = useState("");
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function renderDiagram() {
    if (!source.trim() || rendering) return;
    setRendering(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/asymptote/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not render this diagram.");
        return;
      }
      onRendered(body.asset as AuthoringImageAsset);
      setSource("");
    } catch {
      setError("Could not reach the Asymptote renderer.");
    } finally {
      setRendering(false);
    }
  }

  return (
    <details className="asymptote-authoring">
      <summary>
        <Braces size={15} /> Asymptote diagram
      </summary>
      <div className="asymptote-authoring-body">
        <textarea
          aria-label="Asymptote source"
          className="form-input form-textarea asymptote-source"
          maxLength={40_000}
          onChange={(event) => setSource(event.target.value)}
          placeholder={"size(180);\ndraw(unitcircle);\ndot((0,0));"}
          rows={7}
          spellCheck={false}
          value={source}
        />
        <div className="asymptote-authoring-actions">
          <small>Rendered in a restricted server sandbox and stored as PNG.</small>
          <button
            className="secondary-action compact"
            disabled={rendering || !source.trim()}
            onClick={() => void renderDiagram()}
            type="button"
          >
            {rendering ? (
              <MathCurveLoader size={15} label="Rendering diagram" />
            ) : (
              <Braces size={15} />
            )}
            {rendering ? "Rendering..." : "Render and attach"}
          </button>
        </div>
        {error ? <span className="form-error">{error}</span> : null}
      </div>
    </details>
  );
}

export function MultipleChoiceAuthoringControl({
  answerKey,
  assets,
  groupName,
  onAdd,
  onAnswerChange,
  onChange,
  onImage,
  onRemove,
  options,
}: {
  answerKey: string;
  assets: Record<string, string>;
  groupName: string;
  onAdd: () => void;
  onAnswerChange: (value: string) => void;
  onChange: (index: number, value: string) => void;
  onImage: (index: number, file: File | undefined) => void;
  onRemove: (index: number) => void;
  options: string[];
}) {
  return (
    <div className="mc-authoring">
      <div className="mc-authoring-head">
        <div>
          <strong>Choices</strong>
          <small>
            Select the correct choice. Each choice supports LaTeX and one or more images.
          </small>
        </div>
        <button
          className="secondary-action compact"
          disabled={options.length >= 20}
          onClick={onAdd}
          type="button"
        >
          <Plus size={15} /> Add choice
        </button>
      </div>
      <div className="mc-option-list">
        {options.map((option, index) => (
          <div className="mc-option-editor" key={index}>
            <label className="mc-correct-picker" title="Mark as correct">
              <input
                checked={answerKey === option}
                name={`correct-choice-${groupName}`}
                onChange={() => onAnswerChange(option)}
                type="radio"
              />
              <span>{String.fromCharCode(65 + index)}</span>
            </label>
            <div className="mc-option-content">
              <textarea
                aria-label={`Choice ${index + 1}`}
                className="form-input form-textarea"
                maxLength={4_000}
                onChange={(event) => onChange(index, event.target.value)}
                rows={2}
                value={option}
              />
              {option.trim() ? (
                <div className="mc-option-preview">
                  <LatexStatement statement={option} assets={assets} />
                </div>
              ) : null}
              <label className="mc-option-image">
                <ImageIcon size={14} />
                <span>Add image</span>
                <input
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => {
                    onImage(index, event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
              </label>
            </div>
            <button
              aria-label={`Remove choice ${index + 1}`}
              className="icon-button-sm icon-button-danger"
              disabled={options.length <= 2}
              onClick={() => onRemove(index)}
              title="Remove choice"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
