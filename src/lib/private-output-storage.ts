import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

export function getPrivateOutputPathParts(directoryName: string, fileName: string) {
  const safeDirectoryName = directoryName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storedFileName = `${Date.now()}-${safeFileName}`;
  const relativePath = join(safeDirectoryName, storedFileName);
  const absoluteDirectory = join(process.cwd(), ".worship-flow-private", safeDirectoryName);

  return {
    absoluteDirectory,
    absolutePath: join(process.cwd(), ".worship-flow-private", relativePath),
    publicPath: null,
    relativePath,
    storedFileName,
  };
}

export async function savePrivateOutputFile(
  directoryName: string,
  fileName: string,
  data: Uint8Array
) {
  const pathParts = getPrivateOutputPathParts(directoryName, fileName);
  await mkdir(pathParts.absoluteDirectory, { recursive: true });
  await writeFile(pathParts.absolutePath, data);
  return pathParts;
}

export async function readPrivateOutputFile(relativePath: string) {
  if (relativePath.includes("..")) {
    throw new Error("Invalid output path.");
  }

  return readFile(join(process.cwd(), ".worship-flow-private", relativePath));
}
