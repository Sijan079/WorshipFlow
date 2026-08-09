import assert from "node:assert/strict";

export async function runContentSecurityPolicyTests() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  const { default: nextConfig } = await import("../../next.config.ts");
  const headers = await nextConfig.headers?.();
  const csp = headers?.[0]?.headers?.find((header) => header.key === "Content-Security-Policy")?.value;

  assert.match(csp ?? "", /connect-src[^;]*https:\/\/project\.supabase\.co/);
  assert.match(csp ?? "", /img-src[^;]*https:\/\/\*\.googleusercontent\.com/);
}
