import prisma from "@/lib/prisma";
import { imageIdsIn, missingImageIds } from "./image-refs";

export const MAX_IMAGES_PER_CHURCH = 200;

// A page may only use pictures the church uploaded itself. Checked every time a page is saved, because the
// path in a block is typed data and not proof of anything.
export async function unavailableImagesIn(workspaceId: string, blocks: Array<{ type: string; content: unknown }>) {
  const wanted = imageIdsIn(blocks);
  if (wanted.length === 0) return [];
  const owned = await prisma.siteImage.findMany({ where: { workspaceId, id: { in: wanted } }, select: { id: true } });
  return missingImageIds(wanted, new Set(owned.map((image) => image.id)));
}
