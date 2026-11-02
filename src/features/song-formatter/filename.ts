/** Download names, not storage paths. Preserve human-readable song titles. */
function songFileBase(title: string, extension: string) {
  const suffix = `.${extension}`;
  let base = title.trim();
  if (base.toLowerCase().endsWith(suffix)) base = base.slice(0, -suffix.length);
  base = Array.from(base, char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || /[<>:"/\\|?*]/.test(char) ? "_" : char).join("");
  base = Array.from(base).slice(0, 120).join("").replace(/[. ]+$/, "") || "Untitled song";
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(base)) base = `_${base}`;
  return `${base}.${extension}`;
}

export const songDocxFileName = (title: string) => songFileBase(title, "docx");
export const songTextFileName = (title: string) => songFileBase(title, "txt");

export function songDownloadDisposition(title: string) {
  const name = songDocxFileName(title);
  const fallback = Array.from(name, char => char.charCodeAt(0) > 126 ? "_" : char).join("");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function downloadFileName(header: string) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try { return decodeURIComponent(encoded[1]); } catch { /* Fall back to quoted ASCII name. */ }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? "download.bin";
}
