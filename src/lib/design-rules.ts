// Mechanical checks for DESIGN.md Target rules. Pure string scanners, no file access.

const SMALL_TEXT_CLASS = /\btext-\[(\d+(?:\.\d+)?)(px|rem)\]/g;
const RAW_HEX_COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

export function countSmallTextClasses(source: string) {
  let count = 0;
  for (const match of source.matchAll(SMALL_TEXT_CLASS)) {
    const pixels = match[2] === "rem" ? Number(match[1]) * 16 : Number(match[1]);
    if (pixels < 12) count += 1;
  }
  return count;
}

export function countRawHexColors(source: string) {
  return Array.from(source.matchAll(RAW_HEX_COLOR)).length;
}
