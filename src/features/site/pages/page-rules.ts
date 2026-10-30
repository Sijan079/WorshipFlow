import { SITE_LIMITS, pageSlugFromTitle } from "../blocks/block-validation.ts";

export const HOME_SLUG = "home";
// Addresses the public site already uses for something else: the home page, and /c/{church}/image/{picture}.
const RESERVED_SLUGS = [HOME_SLUG, "image"];

type Status = "DRAFT" | "PUBLISHED";
type PageUpdateInput = { title?: string; description?: string; blocks?: unknown[]; showTitle?: boolean; status?: Status; isPublic?: boolean };
export type PageUpdateDecision = { ok: true; status: Status | undefined; sentBackToDraft: boolean } | { ok: false; error: string };

// The same rule as announcements: without Publish a person can edit the words of a live page, but that sends it
// back to Draft until someone who can publish approves it, so Edit alone never changes what visitors see.
export function decidePageUpdate({ existing, input, canPublish }: { existing: { status: Status; isPublic: boolean }; input: PageUpdateInput; canPublish: boolean }): PageUpdateDecision {
  if (canPublish) return { ok: true, status: undefined, sentBackToDraft: false };
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const publicChanged = input.isPublic !== undefined && input.isPublic !== existing.isPublic;
  if (statusChanged || publicChanged) {
    return { ok: false, error: "Only people who can publish can publish, unpublish, or change the website setting." };
  }
  const contentChanged = [input.title, input.description, input.blocks, input.showTitle].some((value) => value !== undefined);
  if (existing.status === "PUBLISHED" && contentChanged) return { ok: true, status: "DRAFT", sentBackToDraft: true };
  return { ok: true, status: undefined, sentBackToDraft: false };
}

// Only a draft is deleted (a live page is unpublished first), and the home page is never deleted.
export function canDeletePage(page: { slug: string; status: Status }) {
  return page.slug !== HOME_SLUG && page.status === "DRAFT";
}

export function canAddPage(currentCount: number) {
  return currentCount < SITE_LIMITS.pagesPerChurch;
}

// "home" always belongs to the home page, and "image" to the pictures, so a page titled "Home" becomes home-2.
export function uniquePageSlug(title: string, taken: Set<string>) {
  const base = pageSlugFromTitle(title);
  const used = new Set([...taken, ...RESERVED_SLUGS]);
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

type MenuPage = { slug: string; title: string; status: Status; isPublic: boolean; sortOrder: number };

// Home first, then the church's own order. A page is in the menu only when it is published and public.
export function menuPages<T extends MenuPage>(pages: T[]) {
  return pages
    .filter((page) => page.status === "PUBLISHED" && page.isPublic)
    .sort((a, b) => (a.slug === HOME_SLUG ? -1 : b.slug === HOME_SLUG ? 1 : a.sortOrder - b.sortOrder));
}

export function nextSortOrder(orders: number[]) {
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

// Every page needs one main heading for screen readers and search engines. It is the page title, or, when the title
// is hidden, the headline of a Cover.
export function hasMainHeading({ showTitle, blocks }: { showTitle: boolean; blocks: Array<{ type: string }> }) {
  return showTitle || blocks.some((block) => block.type === "COVER");
}

type PageAddress = { id: string; title: string; slug: string };

// Swapping the home page: the chosen page takes the address "home", and the old home page becomes an ordinary page
// with an address made from its title. The address the chosen page leaves behind is free for the old home page.
export function planHomeSwap({ pages, targetId }: { pages: PageAddress[]; targetId: string }):
  { ok: true; oldHome: { id: string; newSlug: string } | null } | { ok: false; error: string } {
  const target = pages.find((page) => page.id === targetId);
  if (!target) return { ok: false, error: "Page not found." };
  if (target.slug === HOME_SLUG) return { ok: false, error: "This page is already the home page." };
  const oldHome = pages.find((page) => page.slug === HOME_SLUG);
  if (!oldHome) return { ok: true, oldHome: null };
  const taken = new Set(pages.filter((page) => page.id !== oldHome.id && page.id !== target.id).map((page) => page.slug));
  return { ok: true, oldHome: { id: oldHome.id, newSlug: uniquePageSlug(oldHome.title, taken) } };
}
