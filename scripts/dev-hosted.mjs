import { spawn } from "node:child_process";
import path from "node:path";
import { validateHostedDevEnvironment } from "./dev-hosted-config.mjs";

let projectRef;
try {
  projectRef = validateHostedDevEnvironment(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log(`Starting Next.js with hosted Supabase project ${projectRef}.`);
console.log("Database migrations are not applied automatically. Use npm run dev:docker for local Supabase.");

const nextCli = path.join("node_modules", "next", "dist", "bin", "next");
const next = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

next.on("error", (error) => {
  console.error("Failed to start Next.js:", error);
  process.exitCode = 1;
});
next.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
