import assert from "node:assert/strict";
import { test } from "node:test";
import { PageInputSchema, SITE_LIMITS, SiteBlockSchema, countBlocks } from "./block-validation.ts";

const text = (value = "Hello") => ({ type: "PARAGRAPH" as const, content: { runs: [{ text: value }], align: "left" as const, size: "normal" as const } });
const column = (blocks: unknown[] = [text()]) => ({ blocks });
const columns = (over: Record<string, unknown> = {}, cols: unknown[] = [column(), column()]) => ({
  type: "COLUMNS",
  content: { columns: cols, valign: "top", cards: false, width: "wide", ...over },
});
const section = (blocks: unknown[]) => ({ type: "SECTION", content: { background: "tinted", overlay: "medium", padding: "medium", inner: "content", width: "full", blocks } });
const ok = (value: unknown) => SiteBlockSchema.safeParse(value).success;

test("Columns holds two, three or four equal columns, each with its own blocks", () => {
  assert.equal(SITE_LIMITS.columnBlocks, 15);
  for (const count of [2, 3, 4]) assert.ok(ok(columns({}, Array.from({ length: count }, () => column()))), String(count));
  assert.equal(ok(columns({}, [column()])), false, "one column is not columns");
  assert.equal(ok(columns({}, Array.from({ length: 5 }, () => column()))), false);
  assert.ok(ok(columns({}, [column([]), column([])])), "empty columns are fine while a page is being built");
});

test("the look of Columns only takes the offered choices", () => {
  for (const valign of ["top", "center"]) assert.ok(ok(columns({ valign })), valign);
  for (const cards of [true, false]) assert.ok(ok(columns({ cards })), String(cards));
  for (const width of ["content", "wide", "full"]) assert.ok(ok(columns({ width })), width);
  assert.equal(ok(columns({ valign: "bottom" })), false);
  assert.equal(ok(columns({ cards: "yes" })), false);
  assert.equal(ok(columns({ width: "huge" })), false);
  assert.equal(ok(columns({ color: "#ff0000" })), false, "no free colours");
});

test("blocks inside a column follow the same rules as blocks on the page", () => {
  assert.equal(ok(columns({}, [column([{ type: "BUTTON", content: { label: "Go", link: { kind: "url", url: "javascript:alert(1)" }, align: "left" } }]), column()])), false);
  assert.equal(ok(columns({}, [column([{ type: "HTML", content: { html: "<b>x</b>" } }]), column()])), false);
  assert.ok(ok(columns({}, [column([{ type: "HEADING", content: { text: "Visit", level: 3, align: "left" } }, text()]), column([{ type: "SERVICE_TIMES", content: { lines: ["Sunday 9:00 AM"] } }])])));
});

test("a column holds at most 15 blocks", () => {
  assert.ok(ok(columns({}, [column(Array.from({ length: 15 }, () => text())), column()])));
  assert.equal(ok(columns({}, [column(Array.from({ length: 16 }, () => text())), column()])), false);
});

test("Columns can go on the page or inside a Section, but never inside a column, and a column holds no layout blocks", () => {
  assert.ok(ok(section([columns()])), "inside a Section");
  assert.equal(ok(columns({}, [column([columns()]), column()])), false, "no Columns inside a column");
  assert.equal(ok(columns({}, [column([section([])]), column()])), false, "no Section inside a column");
  assert.equal(ok(columns({}, [column([{ type: "COVER", content: { headline: "x", overlay: "medium", height: "tall", align: "center", focus: "center", width: "full", buttons: [] } }]), column()])), false, "no Cover inside a column");
});

test("a Section may hold Columns next to its other blocks", () => {
  assert.ok(ok(section([text(), columns(), text()])));
  assert.equal(ok(section(Array.from({ length: 31 }, () => text()))), false, "the Section still holds at most 30");
});

test("blocks are counted at every level: Columns counts once, and so does each block inside its columns", () => {
  assert.equal(countBlocks([columns({}, [column([text(), text()]), column([text()])])] as never), 4);
  assert.equal(countBlocks([section([text(), columns({}, [column([text(), text()]), column([text()])])])] as never), 6, "Section, text, Columns and the three blocks in its columns");
  // 20 Columns blocks holding 5 blocks each is 120 in all, although only 20 sit at the top.
  const many = Array.from({ length: 20 }, () => columns({}, [column(Array.from({ length: 3 }, () => text())), column(Array.from({ length: 2 }, () => text()))]));
  assert.equal(PageInputSchema.safeParse({ title: "Home", blocks: many }).success, false);
});
