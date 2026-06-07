import { runPrivateOutputStorageTests } from "./lib/private-output-storage.test.ts";
import { runSecurityContextTests } from "./lib/security-context.test.ts";
import packageJson from "../package.json" with { type: "json" };

runSecurityContextTests();
runPrivateOutputStorageTests();

if (packageJson.scripts["vercel-build"] !== "node scripts/vercel-build.mjs") {
  throw new Error("vercel-build must run the deployment build script");
}

console.log("security tests passed");
