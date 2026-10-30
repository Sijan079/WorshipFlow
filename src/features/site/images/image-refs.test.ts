import assert from "node:assert/strict";
import { test } from "node:test";
import { imageIdFromPath, imageIdsIn, imagePathFor, missingImageIds } from "./image-refs.ts";

const id = "3f2b8c1e-5d4a-4e7b-9c6a-1b2c3d4e5f60";

test("an image block points at a stored image by id, and the path round-trips", () => {
  assert.equal(imagePathFor(id), `site/${id}.webp`);
  assert.equal(imageIdFromPath(imagePathFor(id)), id);
});

test("anything that is not a stored image's own path has no id", () => {
  for (const path of ["", "site/abc.webp", `site/${id}.png`, `other/${id}.webp`, `site/../${id}.webp`, `https://evil.example/${id}.webp`]) {
    assert.equal(imageIdFromPath(path), null, path);
  }
});

test("a page's images are listed once each, in order", () => {
  const image = (value: string) => ({ type: "IMAGE" as const, content: { path: imagePathFor(value), alt: "x", align: "left" as const } });
  const other = "11111111-2222-4333-8444-555555555555";
  const blocks = [image(id), { type: "SPACER" as const, content: { size: "small" as const } }, image(other), image(id)];
  assert.deepEqual(imageIdsIn(blocks), [id, other]);
});

test("pictures inside a Section, and a Section's background picture, are listed too", () => {
  const a = "11111111-2222-4333-8444-555555555555";
  const b = "66666666-7777-4888-8999-000000000000";
  const c = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const blocks = [
    { type: "SECTION", content: { background: "picture", picture: imagePathFor(a), overlay: "medium", padding: "medium", inner: "content", width: "full", blocks: [
      { type: "IMAGE", content: { path: imagePathFor(b), alt: "x", align: "left" } },
      { type: "IMAGE", content: { path: imagePathFor(a), alt: "x", align: "left" } },
    ] } },
    { type: "IMAGE", content: { path: imagePathFor(c), alt: "x", align: "left" } },
  ];
  assert.deepEqual(imageIdsIn(blocks), [a, b, c]);
});

test("a Cover's picture is listed too", () => {
  const a = "11111111-2222-4333-8444-555555555555";
  const cover = { type: "COVER", content: { headline: "Hi", picture: imagePathFor(a), overlay: "medium", height: "tall", align: "center", focus: "center", width: "full", buttons: [] } };
  assert.deepEqual(imageIdsIn([cover]), [a]);
});

test("pictures inside columns are listed too, on the page and inside a Section", () => {
  const a = "11111111-2222-4333-8444-555555555555";
  const b = "66666666-7777-4888-8999-000000000000";
  const picture = (id: string) => ({ type: "IMAGE", content: { path: imagePathFor(id), alt: "x", align: "left" } });
  const columns = (...ids: string[]) => ({ type: "COLUMNS", content: { valign: "top", cards: false, width: "wide", columns: [{ blocks: ids.map(picture) }, { blocks: [] }] } });
  const section = { type: "SECTION", content: { background: "none", overlay: "medium", padding: "small", inner: "wide", width: "full", blocks: [columns(b)] } };
  assert.deepEqual(imageIdsIn([columns(a), section]), [a, b]);
});

test("a page cannot use an image that the church does not own", () => {
  const mine = "11111111-2222-4333-8444-555555555555";
  assert.deepEqual(missingImageIds([id, mine], new Set([mine])), [id]);
  assert.deepEqual(missingImageIds([mine], new Set([mine])), []);
});
