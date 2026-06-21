import "dotenv/config";
import { spawnSync } from "node:child_process";
import dns from "node:dns/promises";
import net from "node:net";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  return result;
}

function runOrExit(command, args, options = {}) {
  const result = run(command, args, options);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function summarizeDatabaseUrl(label, value) {
  if (!value) {
    console.log(`${label}: missing`);
    return;
  }

  try {
    const parsed = new URL(value);
    console.log(
      `${label}: protocol=${parsed.protocol.replace(":", "")} host=${parsed.hostname} port=${parsed.port || "(default)"} hasPassword=${parsed.password ? "yes" : "no"}`
    );
  } catch {
    console.log(`${label}: present but not parseable as URL`);
  }
}

async function probeDatabaseHost(label, value) {
  if (!value) {
    console.log(`${label} probe: skipped (missing URL)`);
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.log(`${label} probe: skipped (invalid URL)`);
    return;
  }

  const host = parsed.hostname;
  const port = Number(parsed.port || 5432);

  try {
    const lookup = await dns.lookup(host, { all: true });
    console.log(
      `${label} DNS: ${lookup.map((entry) => `${entry.address}/${entry.family}`).join(", ")}`
    );
  } catch (error) {
    console.log(`${label} DNS failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      console.log(`${label} TCP: timeout connecting to ${host}:${port}`);
      resolve();
    }, 5000);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      console.log(`${label} TCP: connected to ${host}:${port}`);
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      console.log(`${label} TCP failed: ${error.message}`);
      resolve();
    });
  });
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for the Vercel build.");
  process.exit(1);
}

console.log("Build env summary:");
summarizeDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
summarizeDatabaseUrl("DIRECT_DATABASE_URL", process.env.DIRECT_DATABASE_URL);
console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV ?? "unset"}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV ?? "unset"}`);

await probeDatabaseHost("DATABASE_URL", process.env.DATABASE_URL);
await probeDatabaseHost("DIRECT_DATABASE_URL", process.env.DIRECT_DATABASE_URL);

if (process.env.DIRECT_DATABASE_URL) {
  console.log("Running prisma migrate deploy against DIRECT_DATABASE_URL...");
  const migrateResult = run("npx", ["prisma", "migrate", "deploy"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DIRECT_DATABASE_URL,
    },
  });

  if (migrateResult.status !== 0) {
    console.warn(`prisma migrate deploy failed with status ${migrateResult.status ?? "unknown"}; continuing build`);
  }
} else {
  console.log("DIRECT_DATABASE_URL is not set; skipping prisma migrate deploy.");
}

runOrExit("npx", ["prisma", "generate"]);
runOrExit("npx", ["next", "build"]);
