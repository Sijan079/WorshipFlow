import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const dockerStartupTimeoutMs = 120_000;
const dockerDesktopPath = path.join(
  process.env.ProgramFiles ?? "C:\\Program Files",
  "Docker",
  "Docker",
  "Docker Desktop.exe",
);

function runOrExit(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isDockerReady() {
  const result = spawnSync("docker", ["info"], {
    shell: process.platform === "win32",
    stdio: "ignore",
  });

  return result.status === 0;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureDockerReady() {
  if (isDockerReady() || process.platform !== "win32") {
    return;
  }

  if (!existsSync(dockerDesktopPath)) {
    throw new Error(
      "Docker is not running and Docker Desktop.exe was not found. Start Docker, then run npm run dev again.",
    );
  }

  console.log("Docker is not running. Starting Docker Desktop...");
  const dockerDesktop = spawn(dockerDesktopPath, [], {
    detached: true,
    stdio: "ignore",
  });
  dockerDesktop.unref();

  const deadline = Date.now() + dockerStartupTimeoutMs;
  while (Date.now() < deadline) {
    await sleep(2_000);
    if (isDockerReady()) {
      console.log("Docker Desktop is ready.");
      return;
    }
  }

  throw new Error(
    "Docker Desktop did not become ready within two minutes. Finish starting Docker Desktop, then run npm run dev again.",
  );
}

try {
  await ensureDockerReady();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log("Starting local Supabase services through Docker...");
runOrExit("npx", ["supabase", "start"]);

const nextCli = path.join("node_modules", "next", "dist", "bin", "next");
const next = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

next.on("error", (error) => {
  console.error("Failed to start the local Next.js server:", error);
  process.exitCode = 1;
});

next.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
