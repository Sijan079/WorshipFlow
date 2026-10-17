import { spawn } from "node:child_process";
import { access, chmod, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import JSZip from "jszip";

const WINDOWS_RELEASE_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip";

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(directory: string): Promise<string | null> {
  if (!(await exists(directory))) return null;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findExecutable(path);
      if (nested) return nested;
    } else if (entry.name.toLowerCase() === "realesrgan-ncnn-vulkan.exe") {
      return path;
    }
  }
  return null;
}

export function buildRealEsrganArguments(inputPath: string, outputPath: string) {
  return ["-i", inputPath, "-o", outputPath, "-n", "realesrgan-x4plus", "-s", "4", "-t", "256", "-f", "png"];
}

export async function ensureRealEsrganExecutable({
  cacheDirectory = resolve(".tmp/tools/realesrgan"),
  executable = process.env.REALESRGAN_EXECUTABLE,
  fetcher = fetch,
}: {
  cacheDirectory?: string;
  executable?: string;
  fetcher?: typeof fetch;
} = {}) {
  if (executable) {
    const resolved = resolve(executable);
    if (!(await exists(resolved))) throw new Error(`REALESRGAN_EXECUTABLE does not exist: ${resolved}`);
    return resolved;
  }
  const cached = await findExecutable(cacheDirectory);
  if (cached) return cached;
  if (process.platform !== "win32") {
    throw new Error("Automatic Real-ESRGAN setup currently supports Windows. Set REALESRGAN_EXECUTABLE for this platform.");
  }

  console.log("Downloading the official portable Real-ESRGAN release (one-time setup)...");
  const response = await fetcher(WINDOWS_RELEASE_URL);
  if (!response.ok) throw new Error(`Real-ESRGAN download failed with status ${response.status}.`);
  const archive = await JSZip.loadAsync(await response.arrayBuffer());
  await mkdir(cacheDirectory, { recursive: true });
  for (const [relativePath, entry] of Object.entries(archive.files)) {
    if (entry.dir) continue;
    const normalized = relativePath.replace(/\\/g, "/");
    if (normalized.split("/").includes("..")) throw new Error("Unsafe path in Real-ESRGAN archive.");
    const destination = join(cacheDirectory, ...normalized.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await entry.async("nodebuffer"));
  }
  const installed = await findExecutable(cacheDirectory);
  if (!installed) throw new Error("The Real-ESRGAN archive did not contain its executable.");
  await chmod(installed, 0o755);
  return installed;
}

export async function upscaleWithRealEsrgan({
  inputPath,
  outputPath,
  executable,
}: {
  inputPath: string;
  outputPath: string;
  executable?: string;
}) {
  const resolvedExecutable = await ensureRealEsrganExecutable({ executable });
  const args = buildRealEsrganArguments(resolve(inputPath), resolve(outputPath));
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(resolvedExecutable, args, { cwd: dirname(resolvedExecutable), windowsHide: true });
    let errorOutput = "";
    child.stderr.on("data", (chunk) => { errorOutput += String(chunk); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Real-ESRGAN exited with code ${code}.${errorOutput ? ` ${errorOutput.trim()}` : ""}`));
    });
  });
  if (!(await exists(outputPath))) throw new Error("Real-ESRGAN completed without producing an output image.");
  return resolve(outputPath);
}
