import katex from "katex";
import {
  normalizeProblemContentFormat,
  type ProblemContentFormat,
} from "@/lib/problem-content-format";

const MATH_SEGMENT_PATTERN = String.raw`(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\[\[img:[a-z0-9][a-z0-9_-]{0,63}\]\])`;
const HAS_MATH_SEGMENT_REGEX = new RegExp(MATH_SEGMENT_PATTERN);
const MATH_SEGMENT_REGEX = new RegExp(MATH_SEGMENT_PATTERN, "g");
const IMG_TOKEN_REGEX = /^\[\[img:([a-z0-9][a-z0-9_-]{0,63})\]\]$/;

type LatexStatementProps = {
  statement: string;
  format?: ProblemContentFormat | string | null;
  assets?: Record<string, string>;
};

function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    throwOnError: false,
    strict: "ignore",
    displayMode,
    trust: false,
  });
}

function parseMathSegment(part: string): { displayMode: boolean; tex: string } | null {
  if (part.startsWith("$$") && part.endsWith("$$")) {
    return { displayMode: true, tex: part.slice(2, -2).trim() };
  }

  if (part.startsWith("\\[") && part.endsWith("\\]")) {
    return { displayMode: true, tex: part.slice(2, -2).trim() };
  }

  if (part.startsWith("\\(") && part.endsWith("\\)")) {
    return { displayMode: false, tex: part.slice(2, -2).trim() };
  }

  if (part.startsWith("$") && part.endsWith("$")) {
    return { displayMode: false, tex: part.slice(1, -1).trim() };
  }

  return null;
}

function looksLikeStandaloneMath(value: string) {
  return (
    /^\\[a-zA-Z]+/.test(value) ||
    (/^[\s\d\\^_{}=+\-*/().,|<>:;]+$/.test(value) && /[\\^_{}=+\-*/]/.test(value))
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeHtmlStatement(raw: string): string {
  let value = raw;
  value = value.replace(/<!--[\s\S]*?-->/g, " ");
  value = value.replace(/<asy\b[^>]*>[\s\S]*?<\/asy>/gi, " ");
  value = value.replace(/<cmath\b[^>]*>([\s\S]*?)<\/cmath>/gi, (_, math: string) => {
    const tex = math.trim();
    return tex ? ` $$${tex}$$ ` : " ";
  });
  value = value.replace(
    /<(?:imath|math)\b[^>]*>([\s\S]*?)<\/(?:imath|math)>/gi,
    (_, math: string) => {
      const tex = math.trim();
      return tex ? ` $${tex}$ ` : " ";
    },
  );
  value = value.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (match, target: string, label: string) =>
    target.startsWith("img:") ? match : label,
  );
  value = value.replace(/\[\[([^\]]+)\]\]/g, (match, target: string) =>
    target.startsWith("img:") ? match : target,
  );
  value = value.replace(
    /<\/?(?:br|p|div|center|li|ul|ol|section|article|tr|td|th|table)\b[^>]*>/gi,
    "\n",
  );
  value = value.replace(/<[^>]+>/g, " ");
  value = decodeHtmlEntities(value);
  value = value.replace(/\r\n?/g, "\n");
  value = value.replace(/[ \t]+\n/g, "\n");
  value = value.replace(/\n{3,}/g, "\n\n");
  return value.trim();
}

function normalizeStatementInput(statement: string, format: ProblemContentFormat): string {
  const value = statement.trim();
  if (!value) {
    return "";
  }
  if (format === "HTML") {
    return normalizeHtmlStatement(value);
  }
  return value;
}

export function LatexStatement({ statement, format, assets }: LatexStatementProps) {
  const normalizedFormat = normalizeProblemContentFormat(format);
  const value = normalizeStatementInput(statement, normalizedFormat);
  if (!value) {
    return <>No statement entered for this problem.</>;
  }

  const hasDelimitedMath = HAS_MATH_SEGMENT_REGEX.test(value);

  if (!hasDelimitedMath) {
    if (looksLikeStandaloneMath(value)) {
      return <span dangerouslySetInnerHTML={{ __html: renderMath(value, true) }} />;
    }
    return <>{value}</>;
  }

  const parts = value.split(MATH_SEGMENT_REGEX).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const imgMatch = part.match(IMG_TOKEN_REGEX);
        if (imgMatch) {
          const url = assets?.[imgMatch[1]];
          if (url) {
            /* eslint-disable-next-line @next/next/no-img-element */
            return <img key={`img-${index}`} src={url} alt="" className="problem-image" />;
          }
          return <span key={`img-${index}`}>{part}</span>;
        }
        const math = parseMathSegment(part);
        if (math) {
          return (
            <span
              className={math.displayMode ? "statement-math-block" : "statement-math-inline"}
              key={`math-${index}`}
              dangerouslySetInnerHTML={{ __html: renderMath(math.tex, math.displayMode) }}
            />
          );
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </>
  );
}
