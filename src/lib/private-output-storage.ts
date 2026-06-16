import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_STORAGE_PREFIX = "supabase:";

function getSupabaseStorageConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PRIVATE_BUCKET;

  if (!url || !key || !bucket) {
    return null;
  }

  return { bucket, key, url };
}

function createSupabaseStorageClient() {
  const config = getSupabaseStorageConfig();
  if (!config) return null;

  return {
    bucket: config.bucket,
    client: createClient(config.url, config.key, {
      auth: {
        persistSession: false,
      },
    }),
  };
}

function toStoragePath(directoryName: string, storedFileName: string) {
  const safeDirectoryName = directoryName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${safeDirectoryName}/${storedFileName}`;
}

function fromSupabaseRelativePath(relativePath: string) {
  if (!relativePath.startsWith(SUPABASE_STORAGE_PREFIX)) return null;
  return relativePath.slice(SUPABASE_STORAGE_PREFIX.length);
}

export function normalizePrivateOutputRelativePath(relativePath: string) {
  return relativePath.replace(/\\/g, "/");
}

export function getPrivateOutputPathParts(directoryName: string, fileName: string) {
  const safeDirectoryName = directoryName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storedFileName = `${Date.now()}-${safeFileName}`;
  const relativePath = normalizePrivateOutputRelativePath(`${safeDirectoryName}/${storedFileName}`);
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
  data: Uint8Array,
  options?: {
    contentType?: string;
  }
) {
  const pathParts = getPrivateOutputPathParts(directoryName, fileName);
  const storage = createSupabaseStorageClient();

  if (storage) {
    const storagePath = toStoragePath(directoryName, pathParts.storedFileName);
    const { error } = await storage.client.storage
      .from(storage.bucket)
      .upload(storagePath, data, {
        cacheControl: "0",
        contentType: options?.contentType || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to save private output to Supabase Storage: ${error.message}`);
    }

    return {
      ...pathParts,
      absolutePath: storagePath,
      publicPath: null,
      relativePath: `${SUPABASE_STORAGE_PREFIX}${storagePath}`,
    };
  }

  await mkdir(pathParts.absoluteDirectory, { recursive: true });
  await writeFile(pathParts.absolutePath, data);
  return pathParts;
}

export async function readPrivateOutputFile(relativePath: string) {
  if (relativePath.includes("..")) {
    throw new Error("Invalid output path.");
  }

  const normalizedRelativePath = normalizePrivateOutputRelativePath(relativePath);
  const supabasePath = fromSupabaseRelativePath(normalizedRelativePath);
  const storage = supabasePath ? createSupabaseStorageClient() : null;
  if (supabasePath && storage) {
    const { data, error } = await storage.client.storage.from(storage.bucket).download(supabasePath);
    if (error) {
      throw new Error(`Failed to read private output from Supabase Storage: ${error.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  return readFile(join(process.cwd(), ".worship-flow-private", ...normalizedRelativePath.split("/")));
}

export async function deletePrivateOutputFile(relativePath: string) {
  if (relativePath.includes("..")) {
    throw new Error("Invalid output path.");
  }

  const normalizedRelativePath = normalizePrivateOutputRelativePath(relativePath);
  const supabasePath = fromSupabaseRelativePath(normalizedRelativePath);
  const storage = supabasePath ? createSupabaseStorageClient() : null;
  if (supabasePath && storage) {
    const { error } = await storage.client.storage.from(storage.bucket).remove([supabasePath]);
    if (error) {
      throw new Error(`Failed to delete private output from Supabase Storage: ${error.message}`);
    }
    return;
  }

  await rm(join(process.cwd(), ".worship-flow-private", ...normalizedRelativePath.split("/")), { force: true });
}
