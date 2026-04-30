import katex from "katex";

const MATH_SEGMENT_PATTERN = String.raw`(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)`;
const HAS_MATH_SEGMENT_REGEX = new RegExp(MATH_SEGMENT_PATTERN);
const MATH_SEGMENT_REGEX = new RegExp(MATH_SEGMENT_PATTERN, "g");

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

export function LatexStatement({ statement }: { statement: string }) {
  const value = statement.trim();
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
