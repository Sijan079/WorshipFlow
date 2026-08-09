import assert from "node:assert/strict";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  toSafeIntegrationRecord,
} from "./workspace-integrations.ts";

export function runWorkspaceIntegrationTests() {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const encrypted = encryptIntegrationSecret("sk-test-secret", key);

  assert.notEqual(encrypted, "sk-test-secret");
  assert.equal(decryptIntegrationSecret(encrypted, key), "sk-test-secret");
  assert.equal(
    toSafeIntegrationRecord({
      provider: "OPENAI",
      enabled: true,
      apiKeyCiphertext: encrypted,
      extractorModel: "gpt-test",
      backgroundImageModel: null,
      backgroundVideoModel: null,
    }).apiKeyConfigured,
    true,
  );
  assert.equal("apiKeyCiphertext" in toSafeIntegrationRecord({ provider: "OPENAI", enabled: true, apiKeyCiphertext: encrypted }), false);
}
