import { PAP_INBOX_TTL_MS, type PAPTransferFile } from "../types";
import { readImageDimensions } from "../rtc/pap-rtc";

const PAP_INBOX_DB_NAME = "worship-flow-pap";
const PAP_INBOX_STORE_NAME = "pap-inbox-files";
const PAP_INBOX_DB_VERSION = 1;

type StoredPAPInboxFile = Omit<PAPTransferFile, "previewUrl"> & {
  cachedAt: string;
  expiresAt: string;
};

function canUseIndexedDB() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openPAPInboxDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!canUseIndexedDB()) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(PAP_INBOX_DB_NAME, PAP_INBOX_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAP_INBOX_STORE_NAME)) {
        db.createObjectStore(PAP_INBOX_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open PAP inbox cache."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const db = await openPAPInboxDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(PAP_INBOX_STORE_NAME, mode);
    const store = transaction.objectStore(PAP_INBOX_STORE_NAME);
    const request = action(store);
    let result: T | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("PAP inbox cache operation failed."));
    }

    transaction.onerror = () => reject(transaction.error ?? new Error("PAP inbox cache transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("PAP inbox cache transaction was aborted."));
    transaction.oncomplete = () => resolve(result);
  }).finally(() => db.close());
}

export async function cachePAPInboxFile(file: PAPTransferFile) {
  const now = new Date();
  const cacheableFile = { ...file } as Partial<PAPTransferFile>;
  delete cacheableFile.previewUrl;
  const storedFile: StoredPAPInboxFile = {
    ...(cacheableFile as Omit<PAPTransferFile, "previewUrl">),
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PAP_INBOX_TTL_MS).toISOString(),
  };

  await withStore("readwrite", (store) => store.put(storedFile));
}

export async function loadPAPInboxFiles() {
  const now = Date.now();
  const storedFiles = ((await withStore("readonly", (store) => store.getAll())) ?? []) as StoredPAPInboxFile[];
  const restoredFiles: PAPTransferFile[] = [];
  const expiredIds: string[] = [];

  for (const storedFile of storedFiles) {
    if (new Date(storedFile.expiresAt).getTime() <= now) {
      expiredIds.push(storedFile.id);
      continue;
    }

    const previewUrl = URL.createObjectURL(storedFile.blob);
    const dimensions =
      storedFile.dimensions ?? (storedFile.mimeType.startsWith("image/") ? await readImageDimensions(previewUrl) : undefined);

    restoredFiles.push({
      ...storedFile,
      dimensions,
      previewUrl,
      temporary: true,
    });
  }

  await Promise.all(expiredIds.map((id) => deletePAPInboxFile(id)));

  return restoredFiles.sort((a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime());
}

export async function deletePAPInboxFile(fileId: string) {
  await withStore("readwrite", (store) => store.delete(fileId));
}

export async function updatePAPInboxFileName(fileId: string, fileName: string) {
  const storedFile = (await withStore("readonly", (store) => store.get(fileId))) as StoredPAPInboxFile | undefined;
  if (!storedFile) return;
  await withStore("readwrite", (store) => store.put({ ...storedFile, fileName }));
}

export async function clearPAPInboxCache() {
  await withStore("readwrite", (store) => store.clear());
}
