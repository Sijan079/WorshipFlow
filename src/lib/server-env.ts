import { z } from "zod";

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_ACCESS_USER: optionalString,
  APP_ACCESS_PASSWORD: optionalString,
  APP_ACCESS_SESSION_SECRET: optionalString,
  NEXT_PUBLIC_API_URL: optionalUrl,
  NEXT_PUBLIC_PAP_PUBLIC_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_URL: optionalUrl,
  SUPABASE_SECRET_KEY: optionalString,
  SUPABASE_PRIVATE_BUCKET: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_EXTRACTOR_MODEL: optionalString,
  OPENAI_BACKGROUND_IMAGE_MODEL: optionalString,
  OPENAI_BACKGROUND_IMAGE_ESTIMATED_COST_USD: z.coerce.number().nonnegative().optional(),
  GEMINI_API_KEY: optionalString,
  GEMINI_BACKGROUND_VIDEO_MODEL: optionalString,
  MEDIA_GENERATION_IMAGE_HOURLY_LIMIT: z.coerce.number().int().positive().optional(),
  MEDIA_GENERATION_IMAGE_DAILY_LIMIT: z.coerce.number().int().positive().optional(),
  MEDIA_GENERATION_VIDEO_HOURLY_LIMIT: z.coerce.number().int().positive().optional(),
  MEDIA_GENERATION_VIDEO_DAILY_LIMIT: z.coerce.number().int().positive().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  if (parsed.data.VERCEL_ENV === "production" && !parsed.data.APP_ACCESS_PASSWORD) {
    throw new Error("APP_ACCESS_PASSWORD must be set for production deployments.");
  }

  return parsed.data;
}

export function getEnvironmentReport() {
  const env = getServerEnv();

  return {
    database: Boolean(env.DATABASE_URL),
    accessGate: Boolean(env.APP_ACCESS_PASSWORD),
    aiExtractor: Boolean(env.OPENAI_API_KEY),
    mediaGeneration: Boolean(env.OPENAI_API_KEY || env.GEMINI_API_KEY),
    papPublicUrl: Boolean(env.NEXT_PUBLIC_PAP_PUBLIC_URL),
    supabaseRealtime: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    supabasePrivateStorage: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_PRIVATE_BUCKET),
    vercelEnv: env.VERCEL_ENV ?? null,
  };
}
