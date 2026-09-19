export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;
export const PAGE_MARGIN = 96;
export const PAGE_GAP = 24;
export const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2;
export type MeasuredGroup = { positions: number[]; heights: number[] };
export type PageBreak = { pos: number; height: number };

export function pageColumns(zoom: number, width: number, pages: number, mobile: boolean): 1 | 2 {
  return !mobile && pages > 1 && zoom <= 75 && width >= (PAGE_WIDTH * 2 + PAGE_GAP) * zoom / 100 ? 2 : 1;
}

export function pageOrigin(page: number, columns: number) {
  return { left: (page % columns) * (PAGE_WIDTH + PAGE_GAP), top: Math.floor(page / columns) * (PAGE_HEIGHT + PAGE_GAP) };
}

/** Pure layout calculation. Positions are document offsets, never text edits. */
export function paginateGroups(groups: MeasuredGroup[]) {
  let used = 0, pages = 1;
  const breaks: PageBreak[] = [];
  const placements: { pos: number; page: number; top: number }[] = [];
  const nextPage = (pos: number) => {
    breaks.push({ pos, height: CONTENT_HEIGHT - used + PAGE_MARGIN * 2 + PAGE_GAP });
    pages++;
    used = 0;
  };
  for (const group of groups) {
    const total = group.heights.reduce((sum, height) => sum + height, 0);
    if (used > 0 && total <= CONTENT_HEIGHT && used + total > CONTENT_HEIGHT) nextPage(group.positions[0]);
    for (let i = 0; i < group.heights.length; i++) {
      const height = group.heights[i];
      if (used > 0 && used + height > CONTENT_HEIGHT) nextPage(group.positions[i]);
      placements.push({ pos: group.positions[i], page: pages - 1, top: PAGE_MARGIN + used });
      used += height;
    }
  }
  return { pages, breaks, placements };
}
