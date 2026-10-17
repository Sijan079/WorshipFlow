import assert from "node:assert/strict";
import { test } from "node:test";
import { validateHostedDevEnvironment } from "./dev-hosted-config.mjs";

const hostedEnv = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres.exampleproject:password@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://exampleproject.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_URL: "https://exampleproject.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_example",
};

test("hosted dev accepts a matching Supabase project", () => {
  assert.equal(validateHostedDevEnvironment(hostedEnv), "exampleproject");
});

test("hosted dev rejects a local database", () => {
  assert.throws(
    () => validateHostedDevEnvironment({ ...hostedEnv, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" }),
    /hosted Supabase database/i,
  );
});

test("hosted dev rejects a mismatched Storage project", () => {
  assert.throws(
    () => validateHostedDevEnvironment({ ...hostedEnv, SUPABASE_URL: "https://differentproject.supabase.co" }),
    /same Supabase project/i,
  );
});
