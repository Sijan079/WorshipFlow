import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export async function savePublicFile(directoryName: string, fileName: string, data: Uint8Array) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storedFileName = `${Date.now()}-${safeFileName}`;
  const absoluteDirectory = join(process.cwd(), "public", directoryName);
  const absolutePath = join(absoluteDirectory, storedFileName);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, data);

  return {
    absolutePath,
    publicPath: `/${directoryName}/${storedFileName}`,
    storedFileName,
  };
}
