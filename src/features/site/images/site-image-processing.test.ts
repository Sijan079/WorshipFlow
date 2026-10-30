import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { SITE_IMAGE_LIMITS, processSiteImage } from "./site-image-processing.ts";

async function photo(width: number, height: number, format: "jpeg" | "png" = "jpeg") {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });
  return format === "jpeg" ? base.jpeg({ quality: 95 }).toBuffer() : base.png().toBuffer();
}

test("a big photo becomes a WebP no wider than 1600 px", async () => {
  const result = await processSiteImage(await photo(4000, 3000));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.width, SITE_IMAGE_LIMITS.maxWidth);
  assert.equal(result.height, 1200, "the shape is kept");
  const info = await sharp(result.data).metadata();
  assert.equal(info.format, "webp");
  assert.equal(info.width, 1600);
});

test("a small image is not blown up", async () => {
  const result = await processSiteImage(await photo(400, 300));
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.width, 400);
});

test("a PNG is converted too, and the result is smaller than a flat photo of the same size", async () => {
  const png = await photo(1200, 800, "png");
  const result = await processSiteImage(png);
  assert.ok(result.ok);
  if (result.ok) assert.ok(result.data.length < png.length);
});

test("the camera's rotation is applied, and no location data is kept", async () => {
  const rotated = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#336699" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.equal((await sharp(rotated).metadata()).orientation, 6, "the test picture really carries a rotation");
  const result = await processSiteImage(rotated);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.width, 400, "turned upright, so the old height is now the width");
  assert.equal(result.height, 800);
  const info = await sharp(result.data).metadata();
  assert.equal(info.exif, undefined, "metadata is stripped");
});

test("something that is not an image is refused in plain words", async () => {
  for (const bytes of [Buffer.from("<html><script>alert(1)</script></html>"), Buffer.from("%PDF-1.7 not a picture"), Buffer.alloc(0)]) {
    const result = await processSiteImage(bytes);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /picture|image|photo/i);
  }
});

test("an SVG is refused, because it can carry scripts", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
  const result = await processSiteImage(svg);
  assert.equal(result.ok, false);
});

test("a file over 10 MB is refused before it is opened", async () => {
  const result = await processSiteImage(Buffer.alloc(SITE_IMAGE_LIMITS.maxBytes + 1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /10 MB/);
});
