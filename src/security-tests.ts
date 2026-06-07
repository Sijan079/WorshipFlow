import { runPrivateOutputStorageTests } from "./lib/private-output-storage.test.ts";
import { runSecurityContextTests } from "./lib/security-context.test.ts";

runSecurityContextTests();
runPrivateOutputStorageTests();

console.log("security tests passed");
