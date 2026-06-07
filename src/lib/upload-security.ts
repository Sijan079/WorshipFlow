export const UPLOAD_LIMITS = {
  extractorBytes: 15 * 1024 * 1024,
  automationBatchFileBytes: 25 * 1024 * 1024,
  automationBatchTotalBytes: 75 * 1024 * 1024,
} as const;

export const EXTRACTOR_UPLOAD_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
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
