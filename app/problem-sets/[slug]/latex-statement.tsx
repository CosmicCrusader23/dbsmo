import katex from "katex";

const MATH_SEGMENT_REGEX = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;

function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    throwOnError: false,
    strict: "ignore",
    displayMode,
    trust: false,
  });
}

export function LatexStatement({ statement }: { statement: string }) {
  const value = statement.trim();
  if (!value) {
    return <>No statement entered for this problem.</>;
  }

  const hasDelimitedMath = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/.test(value);
  if (!hasDelimitedMath) {
    if (/[\\^_{}]/.test(value)) {
      return <span dangerouslySetInnerHTML={{ __html: renderMath(value, true) }} />;
    }
    return <>{value}</>;
  }

  const parts = value.split(MATH_SEGMENT_REGEX).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const tex = part.slice(2, -2).trim();
          return (
            <span
              className="statement-math-block"
              key={`math-block-${index}`}
              dangerouslySetInnerHTML={{ __html: renderMath(tex, true) }}
            />
          );
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          const tex = part.slice(1, -1).trim();
          return (
            <span
              className="statement-math-inline"
              key={`math-inline-${index}`}
              dangerouslySetInnerHTML={{ __html: renderMath(tex, false) }}
            />
          );
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </>
  );
}
