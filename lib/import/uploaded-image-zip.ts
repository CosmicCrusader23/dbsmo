import { MAX_IMAGE_ZIP_BYTES, type ImageZipInput } from "./image-zip";
import type { ImportIssue } from "./zip-dry-run";

export async function readOptionalImageZip(
  formData: FormData,
  jsonFileName: string,
): Promise<{ imageZip?: ImageZipInput; issues: ImportIssue[] }> {
  const upload = formData.get("imageZip");
  if (!(upload instanceof File) || upload.size === 0) {
    return { issues: [] };
  }

  const issues: ImportIssue[] = [];
  if (upload.size > MAX_IMAGE_ZIP_BYTES) {
    issues.push({
      level: "error",
      message: `Image ZIP exceeds the ${MAX_IMAGE_ZIP_BYTES / 1024 / 1024} MB upload limit.`,
    });
  }

  const jsonBase = baseNameWithoutExtension(jsonFileName, ".json");
  const zipBase = baseNameWithoutExtension(upload.name, ".zip");
  if (jsonBase && zipBase && jsonBase !== zipBase) {
    issues.push({
      level: "error",
      message: `Image ZIP must use the same file name as the JSON (${jsonBase}.zip).`,
    });
  }

  if (issues.some((issue) => issue.level === "error")) {
    return { issues };
  }

  return {
    issues,
    imageZip: {
      fileName: upload.name,
      sizeBytes: upload.size,
      buffer: Buffer.from(await upload.arrayBuffer()),
    },
  };
}

function baseNameWithoutExtension(fileName: string, extension: string) {
  const leaf = fileName.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  return leaf.endsWith(extension) ? leaf.slice(0, -extension.length) : "";
}
