import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptIntegrationSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptIntegrationSecret(payload: string, secret: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid integration secret");
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export type WorkspaceIntegrationRecord = {
  provider: "OPENAI" | "GEMINI";
  enabled: boolean;
  apiKeyCiphertext: string | null;
  extractorModel?: string | null;
  backgroundImageModel?: string | null;
  backgroundVideoModel?: string | null;
};

export function toSafeIntegrationRecord(record: WorkspaceIntegrationRecord) {
  return {
    provider: record.provider,
    enabled: record.enabled,
    apiKeyConfigured: Boolean(record.apiKeyCiphertext),
    extractorModel: record.extractorModel ?? null,
    backgroundImageModel: record.backgroundImageModel ?? null,
    backgroundVideoModel: record.backgroundVideoModel ?? null,
  };
}

export function createIntegrationSecret() {
  return randomBytes(32).toString("hex");
}
