import assert from "node:assert/strict";
import JSZip from "jszip";
import { isUploadedFile, validateDocumentSignature, validateImageSignature } from "./upload-security.ts";

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
  assert.equal(isUploadedFile(pdf), true);
  assert.equal(isUploadedFile("service.pdf"), false);
  assert.match(await validateDocumentSignature(fakePdf) ?? "", /invalid file signature/i);
  assert.equal(await validateDocumentSignature(docx), null);
  assert.match(await validateDocumentSignature(fakeDocx) ?? "", /invalid file signature/i);
  assert.equal(await validateImageSignature(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "image.png", { type: "image/png" })), null);
  assert.match(await validateImageSignature(new File(["not an image"], "image.png", { type: "image/png" })) ?? "", /invalid file signature/i);
}
