const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export function formatPAPDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function getImageExtension(file: File) {
  const originalExtension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  if (originalExtension && /^[a-zA-Z0-9.]+$/.test(originalExtension)) {
    return originalExtension.toLowerCase();
  }
  return MIME_EXTENSION_MAP[file.type] ?? "";
}

export function createPAPBatchFileName(params: {
  file: File;
  batchCreatedAt: Date;
  batchIndex: number;
}) {
  return `PAP_${formatPAPDate(params.batchCreatedAt)}_${params.batchIndex}${getImageExtension(params.file)}`;
}
