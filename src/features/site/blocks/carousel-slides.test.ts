import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_LIMITS } from "./block-validation.ts";
import { addSlide, moveSlide, removeSlide, type CarouselContent } from "./carousel-slides.ts";

const make = (...titles: string[]): CarouselContent => ({ perView: 3, width: "wide", slides: titles.map((title) => ({ title })) });
const titles = (content: CarouselContent) => content.slides.map((slide) => slide.title);

test("a card is added at the end, with room left", () => {
  const next = addSlide(make("A", "B"));
  assert.equal(next.slides.length, 3);
  assert.deepEqual(titles(next).slice(0, 2), ["A", "B"]);
  assert.equal(next.slides[2].title, "", "the new card starts empty, ready to be filled in");
});

test("no more than twelve cards", () => {
  const full = make(...Array.from({ length: SITE_LIMITS.carouselSlides }, (_, i) => `Card ${i}`));
  assert.equal(addSlide(full), full);
});

test("a card can be removed, but never below two", () => {
  assert.deepEqual(titles(removeSlide(make("A", "B", "C"), 1)), ["A", "C"]);
  const two = make("A", "B");
  assert.equal(removeSlide(two, 0), two);
});

test("cards move earlier or later, and stop at the ends", () => {
  const content = make("A", "B", "C");
  assert.deepEqual(titles(moveSlide(content, 2, "up")), ["A", "C", "B"]);
  assert.deepEqual(titles(moveSlide(content, 0, "down")), ["B", "A", "C"]);
  assert.equal(moveSlide(content, 0, "up"), content);
  assert.equal(moveSlide(content, 2, "down"), content);
});

test("the other settings are kept, and the original is never changed", () => {
  const content = { ...make("A", "B"), perView: 4 as const, label: "Our ministries" };
  const next = addSlide(content);
  assert.equal(next.perView, 4);
  assert.equal(next.label, "Our ministries");
  assert.equal(content.slides.length, 2, "the original still has two cards");
});
