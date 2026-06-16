import assert from "node:assert/strict";
import { isPAPDatabaseUnavailableError } from "./pap-api-errors.ts";

export function runPAPApiErrorTests() {
  assert.equal(
    isPAPDatabaseUnavailableError({
      code: "P2010",
      meta: {
        code: "N/A",
        message: "Database not reachable: aws-1-ap-northeast-1.pooler.supabase.com",
      },
    }),
    true
  );

  assert.equal(isPAPDatabaseUnavailableError({ code: "P1001", message: "Cannot reach database server" }), true);
  assert.equal(isPAPDatabaseUnavailableError(new Error("Database not reachable: local test host")), true);
  assert.equal(isPAPDatabaseUnavailableError(new Error("Unique constraint failed")), false);
}
