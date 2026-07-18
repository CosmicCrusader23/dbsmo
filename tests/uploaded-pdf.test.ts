import { describe, expect, it } from "vitest";
import { decodeUploadedPdf } from "../lib/uploaded-pdf";

function pdfDataUrl(contents = "%PDF-1.7\n%%EOF") {
  return `data:application/pdf;base64,${Buffer.from(contents).toString("base64")}`;
}

describe("decodeUploadedPdf", () => {
  it("accepts PDF bytes and normalizes unsafe file names", () => {
    const decoded = decodeUploadedPdf({
      name: "../../My worksheet",
      dataUrl: pdfDataUrl(),
    });

    expect(decoded.fileName).toBe("..-..-My-worksheet.pdf");
    expect(decoded.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rejects a MIME claim whose bytes are not a PDF", () => {
    expect(() =>
      decodeUploadedPdf({
        name: "not-really.pdf",
        dataUrl: `data:application/pdf;base64,${Buffer.from("plain text").toString("base64")}`,
      }),
    ).toThrow("Uploaded file is not a valid PDF.");
  });

  it("rejects malformed base64", () => {
    expect(() =>
      decodeUploadedPdf({
        name: "bad.pdf",
        dataUrl: "data:application/pdf;base64,ab=c",
      }),
    ).toThrow("PDF upload must be a data URL");
  });
});
