import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractTextFromTemporaryFile } from "./transpose-parser.ts";

function createPdf(text: string) {
  const stream = `BT\n/F1 18 Tf\n72 120 Td\n(${text}) Tj\nET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export async function runTransposeParserTests() {
  const source = await readFile(new URL("./transpose-parser.ts", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const nextConfig = await readFile(new URL("../../next.config.ts", import.meta.url), "utf8");

  assert.match(source, /createRequire\(import\.meta\.url\)/);
  assert.match(source, /require\(["']pdf-parse["']\)/);
  assert.match(packageJson.dependencies["@napi-rs/canvas"], /^\^?0\.1\.80$/);
  assert.match(nextConfig, /serverExternalPackages:\s*\["pdf-parse", "@napi-rs\/canvas"\]/);

  const directory = await mkdtemp(join(tmpdir(), "worship-flow-pdf-"));
  const path = join(directory, "lyrics.pdf");
  try {
    await writeFile(path, createPdf("Local lyrics work"));
    const result = await extractTextFromTemporaryFile(path, "application/pdf");
    assert.match(result.text, /Local lyrics work/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
