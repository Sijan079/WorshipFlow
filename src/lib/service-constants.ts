export const BlockType = {
  CALL_TO_WORSHIP: "CALL_TO_WORSHIP",
  PRAISE_AND_WORSHIP: "PRAISE_AND_WORSHIP",
  MC: "MC",
  AWIT_NG_HIMNO: "AWIT_NG_HIMNO",
  TIPAN_PAHAYAG: "TIPAN_PAHAYAG",
  AWIT_NG_PAKIKINIG: "AWIT_NG_PAKIKINIG",
  SCRIPTURE_READING: "SCRIPTURE_READING",
  SERMON: "SERMON",
  AWIT_NG_PAGTUGON: "AWIT_NG_PAGTUGON",
  OFFERING: "OFFERING",
  FLOWERS_FOR_THE_LORD: "FLOWERS_FOR_THE_LORD",
  DETAILS: "DETAILS",
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

export const JobStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobType = {
  TRANSPOSE: "TRANSPOSE",
  FREESHOW_GENERATE: "FREESHOW_GENERATE",
  CAPTION_GENERATE: "CAPTION_GENERATE",
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const ServiceStatus = {
  DRAFT: "DRAFT",
  READY: "READY",
  ARCHIVED: "ARCHIVED",
} as const;

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

export const ServiceVariant = {
  STANDARD: "STANDARD",
  EXTENDED: "EXTENDED",
} as const;

export type ServiceVariant = (typeof ServiceVariant)[keyof typeof ServiceVariant];

export const SongRole = {
  OPENING: "OPENING",
  PRAISE: "PRAISE",
  TRANSITION: "TRANSITION",
  RESPONSE: "RESPONSE",
  SPECIAL: "SPECIAL",
  CUSTOM: "CUSTOM",
} as const;

export type SongRole = (typeof SongRole)[keyof typeof SongRole];

export const ServiceVariantValues = Object.values(ServiceVariant) as [ServiceVariant, ...ServiceVariant[]];
export const ServiceStatusValues = Object.values(ServiceStatus) as [ServiceStatus, ...ServiceStatus[]];
