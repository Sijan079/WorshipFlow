import { extname, resolve } from "node:path";
import { extractTextFromTemporaryFile } from "../src/lib/transpose-parser.ts";

const MIME_TYPES: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
};

const input = process.argv[2];
if (!input) {
  throw new Error("Usage: npm run test:formatter-file -- <file.docx|file.pdf>");
}

const path = resolve(input);
const extension = extname(path).toLowerCase();
const mimeType = MIME_TYPES[extension];
if (!mimeType) {
  throw new Error(`Unsupported formatter file type: ${extension || "no extension"}. Use a DOCX or PDF file.`);
}

const result = await extractTextFromTemporaryFile(path, mimeType);

console.log("=== Processed text ===");
console.log(result.text);
console.log("\n=== Diagnostics ===");
console.log(`Parser: ${result.parser}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Sections: ${result.sectionCount}`);
console.log(`Warnings: ${result.warningCodes.length > 0 ? result.warningCodes.join(", ") : "none"}`);
