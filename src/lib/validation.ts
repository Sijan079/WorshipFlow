import { z } from "zod";
import { ServiceStatus, ServiceVariant, SongRole, JobType } from "@prisma/client";
import { LyricsExtractorJobInputSchema } from "@/lib/extractor-types";

export const WorshipServiceSchema = z.object({
  serviceDate: z.string().transform((val) => new Date(val)),
  ministryName: z.string().min(1, "Ministry name is required"),
  theme: z.string().optional().nullable(),
  status: z.nativeEnum(ServiceStatus).default(ServiceStatus.DRAFT),
  serviceVariant: z.nativeEnum(ServiceVariant).default(ServiceVariant.STANDARD),
});

export const UpdateWorshipServiceSchema = z.object({
  serviceDate: z.string().transform((val) => new Date(val)).optional(),
  ministryName: z.string().min(1).optional(),
  theme: z.string().optional().nullable(),
  status: z.nativeEnum(ServiceStatus).optional(),
});

export const BlockPersonSchema = z.object({
  personName: z.string().min(1, "Person name is required"),
  personTitle: z.string().optional().nullable(),
  order: z.number().int().default(0),
});

export const SongSchema = z.object({
  title: z.string().min(1, "Song title is required"),
  author: z.string().optional().nullable(),
  defaultKey: z.string().optional().nullable(),
  bpm: z.number().int().nullable().optional(),
  language: z.string().optional().nullable(),
  isOriginal: z.boolean().default(false),
});

export const ServiceSongSchema = z.object({
  songId: z.string().uuid("Invalid song ID"),
  blockId: z.string().uuid("Invalid block ID"),
  order: z.number().int().optional(),
  songRole: z.nativeEnum(SongRole),
  pageRef: z.string().optional().nullable(),
});

export const ServiceDetailSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
  blockId: z.string().uuid().optional().nullable(),
});

export const AutomationJobSchema = z.object({
  jobType: z.nativeEnum(JobType),
  inputJson: z.unknown().optional(),
});

export const TemporaryAutomationBatchUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one file is required"),
});

export const TransposeAutomationJobSchema = z.object({
  jobType: z.literal(JobType.TRANSPOSE),
  inputJson: LyricsExtractorJobInputSchema,
});

export const SongTagPresetSchema = z.object({
  label: z.string().trim().min(1, "Tag label is required").max(32, "Tag label is too long"),
  token: z
    .string()
    .trim()
    .min(1, "Tag token is required")
    .max(32, "Tag token is too long")
    .regex(/^[A-Za-z][A-Za-z0-9 -]*$/, "Use letters, numbers, spaces, or hyphens"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex pastel color"),
  order: z.number().int().min(0).default(0),
});

export const UpdateSongTagPresetSchema = SongTagPresetSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);
