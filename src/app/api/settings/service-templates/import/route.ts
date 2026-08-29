import { NextResponse } from "next/server";
import { createRequire } from "module";
import type { PDFParse as PDFParseType } from "pdf-parse";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import { extractTemplateDraftFromPdfText } from "@/lib/template-pdf-import";
import { isUploadedFile, validateDocumentSignature, validateUploadFile } from "@/lib/upload-security";

const require = createRequire(import.meta.url);
function loadPdfParse() {
  // Turbopack must not transform this Node-only load: pdf-parse resolves its
  // own pdf.worker.mjs from node_modules at runtime.
  const loadAtRuntime = new Function("nodeRequire", "packageName", "return nodeRequire(packageName)") as (
    nodeRequire: NodeRequire,
    packageName: string,
  ) => { PDFParse: typeof PDFParseType };
  return loadAtRuntime(require, "pdf-parse");
}

const { PDFParse } = loadPdfParse();
const PDF_IMPORT_LIMIT_BYTES = 5 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireExplicitWorkspaceRole("ADMIN");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: "Choose a PDF program flow to import." }, { status: 400 });
    }

    const uploadError = validateUploadFile(file, {
      allowedMimeTypes: ["application/pdf"],
      allowedExtensions: [".pdf"],
      maxBytes: PDF_IMPORT_LIMIT_BYTES,
    }) ?? await validateDocumentSignature(file);
    if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 });

    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const { text } = await parser.getText();
      return NextResponse.json(extractTemplateDraftFromPdfText(text));
    } finally {
      await parser.destroy();
    }
  } catch (error: unknown) {
    console.error("POST /api/settings/service-templates/import error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Could not import this program PDF.", { exposeInternal: process.env.NODE_ENV !== "production" }) }, { status: 500 });
  }
}
