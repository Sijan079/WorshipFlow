import { runPrivateOutputStorageTests } from "./lib/private-output-storage.test.ts";
import { runSecurityContextTests } from "./lib/security-context.test.ts";
import packageJson from "../package.json" with { type: "json" };

runSecurityContextTests();
runPrivateOutputStorageTests();

if (packageJson.scripts["vercel-build"] !== "prisma migrate deploy && prisma generate && next build") {
  throw new Error("vercel-build must apply Prisma migrations before building for deployment");
}

console.log("security tests passed");
