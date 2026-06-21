import { z } from "zod";
import { JobType, ServiceStatus, SongRole } from "@prisma/client";
import { LyricsExtractorJobInputSchema } from "@/lib/extractor-types";
import {
  ASSIGNED_MINISTRY_OPTIONS,
  PLEDGE_TYPE_OPTIONS,
  SERVICE_HYMNAL_ROLES,
  SERVICE_SERVANT_ROLES,
  SERVICE_TEMPLATE_OPTIONS,
} from "@/lib/service-records";

const AssignedMinistrySchema = z.enum(ASSIGNED_MINISTRY_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const ServiceTemplateTypeSchema = z.enum(SERVICE_TEMPLATE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const PledgeTypeSchema = z.enum(PLEDGE_TYPE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const ServiceServantRoleSchema = z.enum(SERVICE_SERVANT_ROLES.map((role) => role.value) as [string, ...string[]]);
const ServiceHymnalRoleSchema = z.enum(SERVICE_HYMNAL_ROLES.map((role) => role.value) as [string, ...string[]]);

export const ServiceBibleVerseSchema = z.object({
  verse: z.string().trim().min(1, "Bible verse is required"),
  order: z.number().int().min(0),
});

export const ServiceServantAssignmentSchema = z.object({
  role: ServiceServantRoleSchema,
  personName: z.string().trim().min(1, "Servant name is required"),
});

export const ServiceHymnalSchema = z.object({
  role: ServiceHymnalRoleSchema,
  title: z.string().trim().min(1, "Hymnal title is required"),
});

export const WorshipServiceSchema = z.object({
  serviceDate: z.string().transform((val) => new Date(val)),
  assignedMinistry: AssignedMinistrySchema,
  sermonVerse: z.string().trim().min(1, "Sermon verse is required"),
  status: z.nativeEnum(ServiceStatus).default(ServiceStatus.DRAFT),
  templateType: ServiceTemplateTypeSchema.default("REGULAR"),
  pledgeType: PledgeTypeSchema.optional().nullable(),
  bibleVerses: z.array(ServiceBibleVerseSchema).default([]),
  servantAssignments: z.array(ServiceServantAssignmentSchema).default([]),
  hymnals: z.array(ServiceHymnalSchema).default([]),
}).superRefine((value, context) => {
  if (value.templateType !== "FIRST_SUNDAY" && value.pledgeType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pledgeType"],
      message: "Pledge selection is only allowed for 1st Sunday.",
    });
  }
});

export const UpdateWorshipServiceSchema = z.object({
  serviceDate: z.string().transform((val) => new Date(val)).optional(),
  assignedMinistry: AssignedMinistrySchema.optional(),
  sermonVerse: z.string().trim().min(1).optional(),
  status: z.nativeEnum(ServiceStatus).optional(),
  templateType: ServiceTemplateTypeSchema.optional(),
  pledgeType: PledgeTypeSchema.optional().nullable(),
  bibleVerses: z.array(ServiceBibleVerseSchema).optional(),
  servantAssignments: z.array(ServiceServantAssignmentSchema).optional(),
  hymnals: z.array(ServiceHymnalSchema).optional(),
}).superRefine((value, context) => {
  if (value.templateType && value.templateType !== "FIRST_SUNDAY" && value.pledgeType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pledgeType"],
      message: "Pledge selection is only allowed for 1st Sunday.",
    });
  }
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
