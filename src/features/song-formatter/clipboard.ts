import { Slice } from "prosemirror-model";
import { documentFromText, getSections, songSchema, type SectionSnapshot } from "./document.ts";

export function sectionClipboardText(section: SectionSnapshot) {
  return [...(section.tag ? [`[${section.tag}]`] : []), ...section.lines].join("\n");
}

export function clipboardSection(text: string): SectionSnapshot | null {
  if (!text.trim()) return null;
  const sections = getSections(documentFromText(text));
  if (sections.length !== 1) return null;
  return { tag: sections[0].tag, lines: [...sections[0].lines] };
}

export function plainTextSlice(text: string) {
  if (/^\s*\[[^\]]+\]\s*$/m.test(text)) return new Slice(documentFromText(text).content, 0, 0);
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map(line =>
    songSchema.nodes.lyric.create(null, line ? songSchema.text(line) : null));
  return new Slice(songSchema.nodes.section.create(null, lines).content, 1, 1);
}

export function copiedText(slice: Slice) {
  const lines: string[] = [];
  slice.content.forEach((node, _offset, index) => {
    if (node.type.name === "section") {
      // A selection starting inside a lyric line does not include its heading.
      if (node.attrs.tag && (index > 0 || slice.openStart < 2)) lines.push(`[${node.attrs.tag}]`);
      node.forEach(line => lines.push(line.textContent));
    } else lines.push(node.textContent);
  });
  return lines.join("\n");
}
