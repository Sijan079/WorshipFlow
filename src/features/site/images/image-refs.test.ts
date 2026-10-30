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

test("a page cannot use an image that the church does not own", () => {
  const mine = "11111111-2222-4333-8444-555555555555";
  assert.deepEqual(missingImageIds([id, mine], new Set([mine])), [id]);
  assert.deepEqual(missingImageIds([mine], new Set([mine])), []);
});
