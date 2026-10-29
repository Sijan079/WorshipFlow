import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { latestFirst, paginate } from "./list-pagination.ts";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index + 1 }));

test("a list is cut into pages of ten, and the footer says which rows are showing", () => {
  const first = paginate(rows(23), 1, 10);
  assert.equal(first.items.length, 10);
  assert.deepEqual([first.page, first.pageCount, first.total, first.from, first.to], [1, 3, 23, 1, 10]);
  const last = paginate(rows(23), 3, 10);
  assert.deepEqual(last.items.map((row) => row.id), [21, 22, 23]);
  assert.deepEqual([last.from, last.to], [21, 23]);
});

test("a page that no longer exists falls back to the nearest one", () => {
  assert.equal(paginate(rows(23), 9, 10).page, 3, "after deleting the last rows");
  assert.equal(paginate(rows(23), 0, 10).page, 1);
  assert.equal(paginate(rows(23), Number.NaN, 10).page, 1);
});

test("an empty list has one empty page and no row range", () => {
  const empty = paginate([], 1, 10);
  assert.deepEqual([empty.items.length, empty.page, empty.pageCount, empty.total, empty.from, empty.to], [0, 1, 1, 0, 0, 0]);
});

test("exactly ten rows is one page", () => {
  const one = paginate(rows(10), 1, 10);
  assert.deepEqual([one.pageCount, one.from, one.to], [1, 1, 10]);
});

test("the latest date comes first, and the original list is left alone", () => {
  const list = [{ id: "a", date: "2026-10-04T00:00:00.000Z" }, { id: "c", date: "2026-11-01T00:00:00.000Z" }, { id: "b", date: "2026-10-18T00:00:00.000Z" }];
  assert.deepEqual(latestFirst(list, (row) => row.date).map((row) => row.id), ["c", "b", "a"]);
  assert.deepEqual(list.map((row) => row.id), ["a", "c", "b"]);
});

test("two rows on the same date keep a steady order", () => {
  const list = [{ id: "x", date: "2026-10-04" }, { id: "y", date: "2026-10-04" }];
  assert.deepEqual(latestFirst(list, (row) => row.date).map((row) => row.id), ["x", "y"]);
});

test("Services shows ten per page, newest first, with controls in a footer", () => {
  const page = read("src", "components", "services-page-client.tsx");
  assert.match(page, /latestFirst\(/);
  assert.match(page, /paginate\(/);
  assert.match(page, /<ListPaginationFooter/);
  const footer = read("src", "components", "ui", "list-pagination-footer.tsx");
  for (const text of ["Previous", "Next", "Page {page} of {pageCount}", "Showing {from}", "<Pagination "]) assert.ok(footer.includes(text), text);
  assert.doesNotMatch(footer, /PaginationLink|isActive|pageNumbers/, "just Page X of Y between the arrows, no numbered buttons");
  assert.doesNotMatch(footer, /sm:hidden|hidden sm:/, "the same text on every screen size");
});

test("the pagination parts are shadcn's, with Previous and Next as quiet icon controls that still have a name", () => {
  const parts = read("src", "components", "ui", "pagination.tsx");
  for (const name of ["Pagination", "PaginationContent", "PaginationItem", "PaginationLink", "PaginationPrevious", "PaginationNext", "PaginationEllipsis"]) assert.ok(parts.includes(`function ${name}`), name);
  assert.doesNotMatch(parts, /variant="outline"/, "no border on the controls");
  assert.match(parts, /aria-label="Go to previous page"/);
  assert.match(parts, /aria-label="Go to next page"/);
  assert.match(parts, /title="Previous page"/);
  assert.match(parts, /title="Next page"/);
  assert.match(parts, /<span className="sr-only">\{text\}<\/span>/, "the words stay for screen readers");
});
