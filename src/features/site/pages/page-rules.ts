import { SITE_LIMITS, pageSlugFromTitle } from "../blocks/block-validation.ts";

export const HOME_SLUG = "home";

type Status = "DRAFT" | "PUBLISHED";
type PageUpdateInput = { title?: string; description?: string; blocks?: unknown[]; status?: Status; isPublic?: boolean };
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
  const contentChanged = [input.title, input.description, input.blocks].some((value) => value !== undefined);
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

// "home" always belongs to the home page, so a page titled "Home" becomes home-2.
export function uniquePageSlug(title: string, taken: Set<string>) {
  const base = pageSlugFromTitle(title);
  const used = new Set(taken).add(HOME_SLUG);
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
