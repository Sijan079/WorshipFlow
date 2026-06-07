import JSZip from "jszip";

function normalizeTitleBlock(lines: string[]) {
  const output: string[] = [];
  let titleSeen = false;
  let currentTitleValue: string | null = null;
  let insideTitleBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const normalized = line.trim().toLowerCase();

    if (normalized === "[title]") {
      if (titleSeen) {
        insideTitleBlock = true;
        continue;
      }

      titleSeen = true;
      insideTitleBlock = true;
      currentTitleValue = null;
      output.push("[Title]");
      continue;
    }

    if (!insideTitleBlock) {
      output.push(line);
      continue;
    }

    if (!line.trim()) {
      output.push("");
      insideTitleBlock = false;
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      output.push(line);
      insideTitleBlock = false;
      continue;
    }

    if (currentTitleValue && normalized === currentTitleValue) {
      continue;
    }

    currentTitleValue = normalized;
    output.push(line);
  }

  return output;
}

export async function createLyricsDocx(text: string) {
  const lines = normalizeTitleBlock(text.split("\n"));
  const zip = new JSZip();

  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.folder("_rels")?.file(".rels", ROOT_RELS_XML);
  zip.folder("word")?.file("document.xml", createDocumentXml(lines));
  zip.folder("word")?.file("styles.xml", STYLES_XML);
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", DOCUMENT_RELS_XML);

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createDocumentXml(lines: string[]) {
  const paragraphs = lines
    .map((line) => {
      if (!line) {
        return "<w:p/>";
      }

      const bold = line.startsWith("[") && line.endsWith("]");
      return `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
</w:styles>`;
