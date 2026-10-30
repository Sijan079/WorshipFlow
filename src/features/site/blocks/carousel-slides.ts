import { SITE_LIMITS, type CarouselBlockInput } from "./block-validation.ts";

export type CarouselContent = CarouselBlockInput["content"];

const MIN_SLIDES = 2;

// A new card goes at the end, empty and ready to be filled in. At the limit, the carousel is returned unchanged.
export function addSlide(content: CarouselContent): CarouselContent {
  if (content.slides.length >= SITE_LIMITS.carouselSlides) return content;
  return { ...content, slides: [...content.slides, { title: "" }] };
}

// A carousel never drops below two cards: one card is not a carousel.
export function removeSlide(content: CarouselContent, index: number): CarouselContent {
  if (content.slides.length <= MIN_SLIDES || index < 0 || index >= content.slides.length) return content;
  return { ...content, slides: content.slides.filter((_, at) => at !== index) };
}

export function moveSlide(content: CarouselContent, index: number, direction: "up" | "down"): CarouselContent {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= content.slides.length || target < 0 || target >= content.slides.length) return content;
  const slides = [...content.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...content, slides };
}
