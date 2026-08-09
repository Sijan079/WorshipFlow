import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { processStandaloneUploadExtractor } from "./extractor-workflow.ts";

async function createLyricsDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Verse 1</w:t></w:r></w:p><w:p><w:r><w:t>You are here, moving in our midst</w:t></w:r></w:p></w:body></w:document>',
  );
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return new File([buffer], "lyrics.docx", {
    type: "application/octet-stream",
  });
}

test("standalone upload extracts lyrics from a valid DOCX", async () => {
  const result = await processStandaloneUploadExtractor(await createLyricsDocx(), "Way Maker");

  assert.equal(result.outputJson.parser, "docx");
  assert.match(result.text, /moving in our midst/i);
});
