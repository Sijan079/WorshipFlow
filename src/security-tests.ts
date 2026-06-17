import { runPrivateOutputStorageTests } from "./lib/private-output-storage.test.ts";
import { runRateLimitTests } from "./lib/rate-limit.test.ts";
import { runSecurityContextTests } from "./lib/security-context.test.ts";
import { runProxyTests } from "./proxy.test.ts";
import { runMediaGenerationTests } from "./features/media-generation/media-generation.test.ts";
import { runBackgroundOutputRetentionTests } from "./features/media-generation/server/background-output-retention.test.ts";
import { runPAPApiErrorTests } from "./features/pap/server/pap-api-errors.test.ts";
import { runPAPDeviceNameTests } from "./features/pap/pap-device-name.test.ts";
import packageJson from "../package.json" with { type: "json" };

runSecurityContextTests();
runPrivateOutputStorageTests();
runRateLimitTests();
runProxyTests();
runMediaGenerationTests();
runBackgroundOutputRetentionTests();
runPAPApiErrorTests();
runPAPDeviceNameTests();

if (packageJson.scripts["vercel-build"] !== "node scripts/vercel-build.mjs") {
  throw new Error("vercel-build must run the deployment build script");
}

console.log("security tests passed");
