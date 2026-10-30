// An image block holds only the id of a stored image. The id is looked up in the church's own images, so a block
// can never name a file that belongs to someone else.

const PATH = /^site\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

export function imagePathFor(imageId: string) {
  return `site/${imageId}.webp`;
}

export function imageIdFromPath(path: string) {
  return PATH.exec(path)?.[1] ?? null;
}

type AnyBlock = { type: string; content: unknown };

// Every picture a page uses, once each, in order: a Section's background picture, the pictures in its blocks, and
// the page's own picture blocks.
export function imageIdsIn(blocks: AnyBlock[]) {
  const ids: string[] = [];
  const add = (path: unknown) => {
    const imageId = typeof path === "string" ? imageIdFromPath(path) : null;
    if (imageId && !ids.includes(imageId)) ids.push(imageId);
  };
  const visit = (list: AnyBlock[]) => {
    for (const block of list) {
      const content = block.content as { path?: unknown; picture?: unknown; blocks?: unknown; columns?: unknown } | null;
      if (block.type === "IMAGE") add(content?.path);
      if (block.type === "COVER") add(content?.picture);
      if (block.type === "COLUMNS" && Array.isArray(content?.columns)) {
        for (const column of content.columns as Array<{ blocks?: unknown }>) if (Array.isArray(column?.blocks)) visit(column.blocks as AnyBlock[]);
      }
      if (block.type === "SECTION") {
        add(content?.picture);
        if (Array.isArray(content?.blocks)) visit(content.blocks as AnyBlock[]);
      }
    }
  };
  visit(blocks);
  return ids;
}

export function missingImageIds(wanted: string[], owned: Set<string>) {
  return wanted.filter((imageId) => !owned.has(imageId));
}
