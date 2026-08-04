import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_SET,
  validateDecodedImage,
  type DecodedAsset,
} from "./import/image-assets";

export const MAX_ASYMPTOTE_SOURCE_CHARS = 40_000;
export const MAX_ASYMPTOTE_BLOCKS_PER_STATEMENT = 8;
export const MAX_ASYMPTOTE_OUTPUT_DIMENSION = 4_096;
export const MAX_ASYMPTOTE_OUTPUT_PIXELS = 16_000_000;

const ASYMPTOTE_BLOCK = /<asy\b[^>]*>([\s\S]*?)<\/asy>/gi;
const MAX_RENDER_STDERR_CHARS = 2_000;
const MAX_RENDER_WORK_BYTES = 32 * 1024 * 1024;
const DEFAULT_RENDER_TIMEOUT_MS = 10_000;

export class AsymptoteRenderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_source"
      | "unavailable"
      | "busy"
      | "timeout"
      | "resource_limit"
      | "compile_failed"
      | "invalid_output",
  ) {
    super(message);
    this.name = "AsymptoteRenderError";
  }
}

export type AsymptoteBlock = {
  raw: string;
  source: string;
  key: string;
};

export function asymptoteAssetKey(source: string): string {
  return `asy-${createHash("sha256").update(source).digest("hex").slice(0, 20)}`;
}

export function extractAsymptoteBlocks(statement: string): AsymptoteBlock[] {
  const blocks: AsymptoteBlock[] = [];
  ASYMPTOTE_BLOCK.lastIndex = 0;

  for (const match of statement.matchAll(ASYMPTOTE_BLOCK)) {
    const source = (match[1] ?? "").replace(/\r\n?/g, "\n").trim();
    if (!source) {
      throw new AsymptoteRenderError("Asymptote blocks cannot be empty.", "invalid_source");
    }
    if (source.length > MAX_ASYMPTOTE_SOURCE_CHARS) {
      throw new AsymptoteRenderError(
        `Asymptote source exceeds ${MAX_ASYMPTOTE_SOURCE_CHARS.toLocaleString()} characters.`,
        "invalid_source",
      );
    }
    blocks.push({ raw: match[0], source, key: asymptoteAssetKey(source) });
  }

  if (blocks.length > MAX_ASYMPTOTE_BLOCKS_PER_STATEMENT) {
    throw new AsymptoteRenderError(
      `A statement can contain at most ${MAX_ASYMPTOTE_BLOCKS_PER_STATEMENT} Asymptote diagrams.`,
      "invalid_source",
    );
  }

  const withoutCompleteBlocks = statement.replace(ASYMPTOTE_BLOCK, "");
  if (/<\/?asy\b/i.test(withoutCompleteBlocks)) {
    throw new AsymptoteRenderError(
      "Asymptote source must use a complete <asy>...</asy> block.",
      "invalid_source",
    );
  }

  return blocks;
}

export function replaceAsymptoteBlocks(statement: string, blocks: AsymptoteBlock[]): string {
  let index = 0;
  return statement.replace(ASYMPTOTE_BLOCK, () => `\n\n[[img:${blocks[index++].key}]]\n\n`);
}

export function validateAsymptotePng(buffer: Buffer): { width: number; height: number } {
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new AsymptoteRenderError("Asymptote did not produce a valid PNG.", "invalid_output");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (
    width === 0 ||
    height === 0 ||
    width > MAX_ASYMPTOTE_OUTPUT_DIMENSION ||
    height > MAX_ASYMPTOTE_OUTPUT_DIMENSION ||
    width * height > MAX_ASYMPTOTE_OUTPUT_PIXELS
  ) {
    throw new AsymptoteRenderError(
      `Asymptote output dimensions ${width}x${height} exceed the safe rendering limit.`,
      "invalid_output",
    );
  }

  return { width, height };
}

let activeRenders = 0;

function runtimePathExists(path: string): boolean {
  return existsSync(/* turbopackIgnore: true */ path);
}

function configuredTimeoutMs(): number {
  const configured = Number(process.env.ASYMPTOTE_RENDER_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 1_000 && configured <= 30_000
    ? configured
    : DEFAULT_RENDER_TIMEOUT_MS;
}

function linuxSandboxCommand(workDir: string) {
  const asy = process.env.ASYMPTOTE_BIN || "/usr/bin/asy";
  const bwrap = process.env.ASYMPTOTE_BWRAP_BIN || "/usr/bin/bwrap";
  const prlimit = process.env.ASYMPTOTE_PRLIMIT_BIN || "/usr/bin/prlimit";
  if (![asy, bwrap, prlimit].every(runtimePathExists)) {
    throw new AsymptoteRenderError(
      "Asymptote rendering is not installed on this server.",
      "unavailable",
    );
  }

  const args = [
    "--cpu=10",
    "--as=805306368",
    `--fsize=${MAX_IMAGE_BYTES * 2}`,
    "--nofile=64",
    "--nproc=64",
    "--",
    bwrap,
    "--die-with-parent",
    "--new-session",
    "--unshare-all",
    "--clearenv",
    "--ro-bind",
    "/usr",
    "/usr",
    "--ro-bind-try",
    "/bin",
    "/bin",
    "--ro-bind-try",
    "/lib",
    "/lib",
    "--ro-bind-try",
    "/lib64",
    "/lib64",
    "--dir",
    "/etc",
    "--ro-bind-try",
    "/etc/fonts",
    "/etc/fonts",
    "--ro-bind-try",
    "/etc/texmf",
    "/etc/texmf",
    "--ro-bind-try",
    "/etc/ImageMagick-6",
    "/etc/ImageMagick-6",
    "--ro-bind-try",
    "/etc/ImageMagick-7",
    "/etc/ImageMagick-7",
    "--dir",
    "/var",
    "--dir",
    "/var/lib",
    "--ro-bind-try",
    "/var/lib/texmf",
    "/var/lib/texmf",
    "--dir",
    "/var/cache",
    "--ro-bind-try",
    "/var/cache/fontconfig",
    "/var/cache/fontconfig",
    "--dev",
    "/dev",
    "--bind",
    workDir,
    "/work",
    "--chdir",
    "/work",
    "--setenv",
    "HOME",
    "/work/home",
    "--setenv",
    "TMPDIR",
    "/work/tmp",
    "--setenv",
    "TEXMFOUTPUT",
    "/work",
    "--setenv",
    "PATH",
    "/usr/bin:/bin",
    asy,
    "-safe",
    "-noV",
    "-f",
    "png",
    "-render",
    "2",
    "-o",
    "diagram",
    "diagram.asy",
  ];
  return { command: prlimit, args };
}

function escapeSandboxLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function macSandboxCommand(workDir: string) {
  if (process.env.NODE_ENV === "production") {
    throw new AsymptoteRenderError(
      "Production Asymptote rendering requires the Linux bubblewrap sandbox.",
      "unavailable",
    );
  }
  const configuredAsy = process.env.ASYMPTOTE_BIN || "/Library/TeX/texbin/asy";
  const sandbox = "/usr/bin/sandbox-exec";
  if (![configuredAsy, sandbox].every(runtimePathExists)) {
    throw new AsymptoteRenderError(
      "Asymptote rendering is not installed on this development machine.",
      "unavailable",
    );
  }
  const asy = realpathSync(/* turbopackIgnore: true */ configuredAsy);

  const escapedWorkDir = escapeSandboxLiteral(
    realpathSync(/* turbopackIgnore: true */ workDir),
  );
  const escapedHomeDir = escapeSandboxLiteral(homedir());
  const profile = `(version 1)
(import "system.sb")
(allow process*)
(deny network*)
(deny file-read* (subpath "${escapedHomeDir}"))
(allow file-read* (subpath "/System") (subpath "/usr") (subpath "/Library") (subpath "/opt/homebrew"))
(allow file-read* (subpath "${escapedWorkDir}"))
(deny file-write*)
(allow file-write* (subpath "${escapedWorkDir}"))
`;
  const profilePath = join(workDir, "asymptote.sb");
  await writeFile(profilePath, profile, { encoding: "utf8", mode: 0o600 });
  return {
    command: sandbox,
    args: [
      "-f",
      profilePath,
      asy,
      "-safe",
      "-noV",
      "-f",
      "png",
      "-render",
      "2",
      "-o",
      "diagram",
      "diagram.asy",
    ],
  };
}

async function sandboxCommand(workDir: string) {
  if (process.env.ASYMPTOTE_ENABLED !== "true") {
    throw new AsymptoteRenderError(
      "Asymptote rendering is disabled. Set ASYMPTOTE_ENABLED=true after installing the sandbox dependencies.",
      "unavailable",
    );
  }
  if (process.platform === "linux") return linuxSandboxCommand(workDir);
  if (process.platform === "darwin") return macSandboxCommand(workDir);
  throw new AsymptoteRenderError(
    "Asymptote rendering is only supported in the Linux or macOS sandbox.",
    "unavailable",
  );
}

async function directoryBytes(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(/* turbopackIgnore: true */ path, {
    withFileTypes: true,
  })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) total += await directoryBytes(child);
    else if (entry.isFile()) {
      total += (await stat(/* turbopackIgnore: true */ child)).size;
    }
    if (total > MAX_RENDER_WORK_BYTES) break;
  }
  return total;
}

export async function renderAsymptotePng(sourceInput: string): Promise<Buffer> {
  const source = sourceInput.replace(/\r\n?/g, "\n").trim();
  if (!source || source.length > MAX_ASYMPTOTE_SOURCE_CHARS) {
    throw new AsymptoteRenderError("Asymptote source is empty or too large.", "invalid_source");
  }
  if (activeRenders >= 1) {
    throw new AsymptoteRenderError("The Asymptote renderer is busy. Try again shortly.", "busy");
  }

  activeRenders += 1;
  let workDir: string | null = null;
  try {
    const renderDir = await mkdtemp(join(tmpdir(), "dbsmo-asy-"));
    workDir = renderDir;
    await mkdir(join(renderDir, "home"), { mode: 0o700 });
    await mkdir(join(renderDir, "tmp"), { mode: 0o700 });
    await writeFile(join(renderDir, "diagram.asy"), source, { encoding: "utf8", mode: 0o600 });
    const { command, args } = await sandboxCommand(renderDir);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: renderDir,
        detached: process.platform !== "win32",
        env: {
          HOME: join(renderDir, "home"),
          NODE_ENV: process.env.NODE_ENV || "development",
          PATH: process.env.PATH || "/usr/bin:/bin",
          TEXMFOUTPUT: renderDir,
          TMPDIR: join(renderDir, "tmp"),
        },
        stdio: ["ignore", "ignore", "pipe"] as const,
      });
      let stderr = "";
      let exceededWorkLimit = false;
      child.stderr.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_RENDER_STDERR_CHARS) stderr += chunk.toString("utf8");
      });

      const terminate = () => {
        try {
          process.kill(process.platform === "win32" ? child.pid! : -child.pid!, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      };
      const timeout = setTimeout(() => {
        terminate();
        reject(new AsymptoteRenderError("Asymptote rendering timed out.", "timeout"));
      }, configuredTimeoutMs());
      const monitor = setInterval(() => {
        void directoryBytes(renderDir)
          .then((bytes) => {
            if (bytes > MAX_RENDER_WORK_BYTES && !exceededWorkLimit) {
              exceededWorkLimit = true;
              terminate();
            }
          })
          .catch(() => undefined);
      }, 150);

      child.once("error", (error) => {
        clearTimeout(timeout);
        clearInterval(monitor);
        reject(
          new AsymptoteRenderError(`Could not start Asymptote: ${error.message}`, "unavailable"),
        );
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        clearInterval(monitor);
        if (exceededWorkLimit) {
          reject(
            new AsymptoteRenderError(
              "Asymptote exceeded its temporary storage limit.",
              "resource_limit",
            ),
          );
        } else if (code === 0) {
          resolve();
        } else {
          const detail = stderr.trim().replaceAll(renderDir, "<workspace>");
          reject(
            new AsymptoteRenderError(
              detail
                ? `Asymptote could not render this source: ${detail}`
                : "Asymptote compilation failed.",
              "compile_failed",
            ),
          );
        }
      });
    });

    let output: Buffer;
    try {
      output = await readFile(
        /* turbopackIgnore: true */ join(renderDir, "diagram.png"),
      );
    } catch {
      throw new AsymptoteRenderError(
        "Asymptote completed without producing one PNG diagram.",
        "invalid_output",
      );
    }
    if (output.byteLength > MAX_IMAGE_BYTES) {
      throw new AsymptoteRenderError(
        "Asymptote output exceeds the 4 MB image limit.",
        "invalid_output",
      );
    }
    validateAsymptotePng(output);
    return output;
  } finally {
    activeRenders -= 1;
    if (workDir) {
      await rm(workDir, { force: true, recursive: true }).catch(() => undefined);
    }
  }
}

export async function renderEmbeddedAsymptoteStatements(
  statements: string[],
  render: (source: string) => Promise<Buffer> = renderAsymptotePng,
): Promise<{ statements: string[]; assets: DecodedAsset[] }> {
  const parsed = statements.map(extractAsymptoteBlocks);
  const unique = new Map<string, AsymptoteBlock>();
  for (const blocks of parsed) {
    for (const block of blocks) unique.set(block.key, block);
  }
  if (unique.size > MAX_IMAGES_PER_SET) {
    throw new AsymptoteRenderError(
      `A problem set can contain at most ${MAX_IMAGES_PER_SET} generated diagrams.`,
      "invalid_source",
    );
  }

  const assets: DecodedAsset[] = [];
  for (const block of unique.values()) {
    const buffer = await render(block.source);
    validateAsymptotePng(buffer);
    const validated = validateDecodedImage({
      key: block.key,
      mimeType: "image/png",
      buffer,
      originalName: `${block.key}.png`,
    });
    if (!validated.ok) {
      throw new AsymptoteRenderError(validated.error, "invalid_output");
    }
    assets.push(validated.asset);
  }

  return {
    statements: statements.map((statement, index) =>
      replaceAsymptoteBlocks(statement, parsed[index]),
    ),
    assets,
  };
}
