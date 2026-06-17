export const PAP_INBOX_RETENTION_MS = 24 * 60 * 60 * 1000;
export const PAP_UPLOAD_MAX_FILES = 12;
export const PAP_UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PAP_UPLOAD_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const PAP_UPLOAD_NOTE_MAX_LENGTH = 180;

export const PAP_IMAGE_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const PAP_IMAGE_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"] as const;
