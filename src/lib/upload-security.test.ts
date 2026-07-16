import assert from "node:assert/strict";
import JSZip from "jszip";
import { validateDocumentSignature } from "./upload-security.ts";

export async function runUploadSecurityTests() {
  const pdf = new File([new TextEncoder().encode("%PDF-1.7")], "service.pdf", { type: "application/pdf" });
  const fakePdf = new File([new TextEncoder().encode("hello")], "service.pdf", { type: "application/pdf" });
  const archive = new JSZip();
  archive.file("[Content_Types].xml", "<Types />");
  archive.file("word/document.xml", "<document />");
  const docx = new File([await archive.generateAsync({ type: "arraybuffer" })], "service.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const fakeDocx = new File([new TextEncoder().encode("hello")], "service.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  assert.equal(await validateDocumentSignature(pdf), null);
  assert.match(await validateDocumentSignature(fakePdf) ?? "", /invalid file signature/i);
  assert.equal(await validateDocumentSignature(docx), null);
  assert.match(await validateDocumentSignature(fakeDocx) ?? "", /invalid file signature/i);
}
