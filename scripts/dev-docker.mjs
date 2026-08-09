import { spawn } from "node:child_process";
import path from "node:path";

const nextCli = path.join("node_modules", "next", "dist", "bin", "next");
const next = spawn(process.execPath, [nextCli, "dev"], {
  env: process.env,
  stdio: "inherit",
});

next.on("error", (error) => {
  console.error("Failed to start the Docker-backed Next.js server:", error);
  process.exitCode = 1;
});

next.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
