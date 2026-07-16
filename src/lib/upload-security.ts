export const UPLOAD_LIMITS = {
  extractorBytes: 15 * 1024 * 1024,
  automationBatchFileBytes: 25 * 1024 * 1024,
  automationBatchTotalBytes: 75 * 1024 * 1024,
} as const;

export const EXTRACTOR_UPLOAD_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

type UploadValidationOptions = {
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  maxBytes: number;
};

export function validateUploadFile(file: File, options: UploadValidationOptions) {
  if (file.size <= 0) {
    return "The uploaded file is empty.";
  }

  if (file.size > options.maxBytes) {
    return `File must be ${formatBytes(options.maxBytes)} or smaller.`;
  }

  const lowerType = file.type.toLowerCase();
  const lowerName = file.name.toLowerCase();
  const hasAllowedMimeType =
    lowerType.length > 0 && options.allowedMimeTypes.some((mimeType) => lowerType === mimeType);
  const hasAllowedExtension = options.allowedExtensions.some((extension) =>
    lowerName.endsWith(extension)
  );

  if (!hasAllowedMimeType && !hasAllowedExtension) {
    return `Unsupported file type. Allowed extensions: ${options.allowedExtensions.join(", ")}.`;
  }

  return null;
}

export async function validateDocumentSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const lowerName = file.name.toLowerCase();
  const isPdf = header.length >= 5 && String.fromCharCode(...header) === "%PDF-";
  const isZip = header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && (
    (header[2] === 0x03 && header[3] === 0x04) ||
    (header[2] === 0x05 && header[3] === 0x06) ||
    (header[2] === 0x07 && header[3] === 0x08)
  );

  if (lowerName.endsWith(".pdf") && !isPdf) return "The uploaded PDF has an invalid file signature.";
  if (lowerName.endsWith(".docx")) {
    if (!isZip) return "The uploaded DOCX has an invalid file signature.";
    try {
      const archive = await JSZip.loadAsync(await file.arrayBuffer());
      if (!archive.file("[Content_Types].xml") || !archive.file("word/document.xml")) {
        return "The uploaded DOCX has an invalid document structure.";
      }
    } catch {
      return "The uploaded DOCX has an invalid document structure.";
    }
  }
  return null;
}

export function validateUploadTotal(files: File[], maxBytes: number) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxBytes) {
    return `Upload batch must be ${formatBytes(maxBytes)} or smaller.`;
  }

  return null;
}

function formatBytes(bytes: number) {
  const megabytes = bytes / 1024 / 1024;
  return `${Math.round(megabytes)} MB`;
}
import JSZip from "jszip";
