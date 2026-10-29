export const PAGE_SIZE = 10;

export type Page<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  // The first and last row shown, counting from 1; both 0 when the list is empty.
  from: number;
  to: number;
};

// One page of a list. A page that does not exist (the last rows were deleted, or a filter shortened the
// list) falls back to the nearest one that does.
export function paginate<T>(rows: T[], requestedPage: number, size = PAGE_SIZE): Page<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const wanted = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(Math.max(wanted, 1), pageCount);
  const start = (page - 1) * size;
  const items = rows.slice(start, start + size);
  return { items, page, pageCount, total, from: items.length ? start + 1 : 0, to: start + items.length };
}

// Newest date first. Rows on the same date keep the order they came in.
export function latestFirst<T>(rows: T[], dateOf: (row: T) => string): T[] {
  return [...rows].sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : 0));
}
