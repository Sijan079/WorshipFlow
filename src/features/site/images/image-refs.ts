// An image block holds only the id of a stored image. The id is looked up in the church's own images, so a block
// can never name a file that belongs to someone else.

const PATH = /^site\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

export function imagePathFor(imageId: string) {
  return `site/${imageId}.webp`;
}

export function imageIdFromPath(path: string) {
  return PATH.exec(path)?.[1] ?? null;
}

export function imageIdsIn(blocks: Array<{ type: string; content: unknown }>) {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type !== "IMAGE") continue;
    const path = (block.content as { path?: unknown }).path;
    const imageId = typeof path === "string" ? imageIdFromPath(path) : null;
    if (imageId && !ids.includes(imageId)) ids.push(imageId);
  }
  return ids;
}

export function missingImageIds(wanted: string[], owned: Set<string>) {
  return wanted.filter((imageId) => !owned.has(imageId));
}
