import prisma from "@/lib/prisma";
import { isPubliclyVisible } from "@/features/posts/post-rules";
import { SiteBlockSchema, type SiteBlockInput } from "@/features/site/blocks/block-validation";
import { imageIdFromPath } from "@/features/site/images/image-refs";
import { HOME_SLUG, menuPages } from "@/features/site/pages/page-rules";
import { nextDatePerEvent } from "./public-events";
import { pageDescription } from "./page-description";

// The only door the public site (/c/{slug}) reads through. It returns a small set of public-safe fields and
// never touches People, Ministry, attendance or service-assignment data. The privacy test checks this folder.

type Listed = "ANNOUNCEMENTS_LIST" | "EVENTS_LIST" | "CONTACT";
type Shown = Exclude<SiteBlockInput, { type: Listed | "IMAGE" }>;

export type PublicBlock =
  | (Shown & { id: string })
  | { id: string; type: "IMAGE"; src: string; alt: string; caption: string | null; align: "left" | "center"; width: number; height: number }
  | { id: string; type: "ANNOUNCEMENTS_LIST"; items: Array<{ id: string; title: string; body: string }> }
  | { id: string; type: "EVENTS_LIST"; items: Array<{ id: string; title: string; venue: string | null; startsAt: string; timezone: string }> }
  | { id: string; type: "CONTACT"; email: string | null; phone: string | null; address: string | null };

export type PublicSite = {
  churchName: string;
  churchSlug: string;
  indexable: boolean;
  // The pages in the menu bar: published and public, home first.
  menu: Array<{ slug: string; title: string }>;
  page: { slug: string; title: string; description: string | null; blocks: PublicBlock[] };
};

const LIST_LIMIT = 10;

type Settings = { indexable: boolean; contactEmail: string | null; contactPhone: string | null; address: string | null } | null;
type PageRows = Array<{ id: string; type: string; content: unknown }>;

const blockRows = { orderBy: { sortOrder: "asc" as const }, select: { id: true, type: true, content: true } };

async function menuFor(workspaceId: string) {
  const pages = await prisma.sitePage.findMany({
    where: { workspaceId, status: "PUBLISHED", isPublic: true },
    select: { slug: true, title: true, status: true, isPublic: true, sortOrder: true },
  });
  return menuPages(pages).map((page) => ({ slug: page.slug, title: page.title }));
}

// Returns null when the church or the page is not public, so the route can show one plain "not available" page
// and never reveal which of the two was missing.
export async function getPublicSite(workspaceSlug: string, pageSlug: string = HOME_SLUG, now = new Date()): Promise<PublicSite | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true, siteSettings: { select: { indexable: true, contactEmail: true, contactPhone: true, address: true } } },
  });
  if (!workspace) return null;

  const page = await prisma.sitePage.findFirst({
    where: { workspaceId: workspace.id, slug: pageSlug, status: "PUBLISHED", isPublic: true },
    select: { slug: true, title: true, description: true, blocks: blockRows },
  });
  if (!page) return null;

  const [menu, built] = await Promise.all([
    menuFor(workspace.id),
    buildPage({ workspaceId: workspace.id, rows: page.blocks, settings: workspace.siteSettings, now, imageSrc: (imageId) => `/c/${workspaceSlug}/image/${imageId}.webp` }),
  ]);
  return {
    churchName: workspace.name,
    churchSlug: workspaceSlug,
    indexable: workspace.siteSettings?.indexable ?? false,
    menu,
    page: { slug: page.slug, title: page.title, description: pageDescription({ description: page.description, blocks: built.parsed }), blocks: built.blocks },
  };
}

// The same page as a visitor would see it, but for a page that is still a draft. Only the editor's own preview
// route uses this, after checking that the person may view this church's website pages, and a draft's pictures
// are read through the editor's own picture address because the public one refuses them.
export async function getPreviewSite(workspaceId: string, pageId: string, workspaceSlug: string, now = new Date()): Promise<PublicSite | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, siteSettings: { select: { indexable: true, contactEmail: true, contactPhone: true, address: true } } },
  });
  if (!workspace) return null;
  const page = await prisma.sitePage.findFirst({
    where: { id: pageId, workspaceId },
    select: { slug: true, title: true, description: true, blocks: blockRows },
  });
  if (!page) return null;
  const [menu, built] = await Promise.all([
    menuFor(workspaceId),
    buildPage({ workspaceId, rows: page.blocks, settings: workspace.siteSettings, now, imageSrc: (imageId) => `/api/workspaces/${workspaceSlug}/site/images/${imageId}` }),
  ]);
  return {
    churchName: workspace.name,
    churchSlug: workspaceSlug,
    indexable: workspace.siteSettings?.indexable ?? false,
    menu,
    page: { slug: page.slug, title: page.title, description: pageDescription({ description: page.description, blocks: built.parsed }), blocks: built.blocks },
  };
}

async function buildPage({ workspaceId, rows, settings, now, imageSrc }: { workspaceId: string; rows: PageRows; settings: Settings; now: Date; imageSrc: (imageId: string) => string }) {
  const blocks: PublicBlock[] = [];
  const parsedBlocks: SiteBlockInput[] = [];
  // Only pictures this church uploaded count, however a block spells its path.
  const wantedImages = rows.flatMap((row) => {
    const path = (row.content as { path?: unknown } | null)?.path;
    return row.type === "IMAGE" && typeof path === "string" ? [imageIdFromPath(path)].filter((id): id is string => id !== null) : [];
  });
  const images = new Map(
    (wantedImages.length === 0 ? [] : await prisma.siteImage.findMany({ where: { workspaceId, id: { in: wantedImages } }, select: { id: true, width: true, height: true } })).map((image) => [image.id, image]),
  );
  for (const row of rows) {
    // A stored block that no longer fits the rules is left out rather than shown half-broken.
    const parsed = SiteBlockSchema.safeParse({ type: row.type, content: row.content });
    if (!parsed.success) continue;
    const block = parsed.data;
    parsedBlocks.push(block);
    switch (block.type) {
      case "IMAGE": {
        const imageId = imageIdFromPath(block.content.path);
        const image = imageId ? images.get(imageId) : undefined;
        if (imageId && image) {
          blocks.push({ id: row.id, type: "IMAGE", src: imageSrc(imageId), alt: block.content.alt, caption: block.content.caption?.trim() || null, align: block.content.align, width: image.width, height: image.height });
        }
        break;
      }
      case "CONTACT":
        blocks.push({ id: row.id, type: "CONTACT", email: settings?.contactEmail ?? null, phone: settings?.contactPhone ?? null, address: settings?.address ?? null });
        break;
      case "ANNOUNCEMENTS_LIST":
        blocks.push({ id: row.id, type: "ANNOUNCEMENTS_LIST", items: await publicAnnouncements(workspaceId, now) });
        break;
      case "EVENTS_LIST":
        blocks.push({ id: row.id, type: "EVENTS_LIST", items: await publicEvents(workspaceId, now) });
        break;
      default:
        blocks.push({ ...block, id: row.id });
    }
  }
  return { blocks, parsed: parsedBlocks };
}

async function publicAnnouncements(workspaceId: string, now: Date) {
  const posts = await prisma.post.findMany({
    where: { workspaceId, kind: "ANNOUNCEMENT", status: "PUBLISHED", isPublic: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, status: true, isPublic: true, startDate: true, endDate: true, timezone: true },
  });
  return posts
    .filter((post) => isPubliclyVisible(post, now))
    .slice(0, LIST_LIMIT)
    .map((post) => ({ id: post.id, title: post.title, body: post.body }));
}

async function publicEvents(workspaceId: string, now: Date) {
  // A repeating event has many dates, so more are read than shown, and each event is listed once on its next date.
  const rows = await prisma.churchEventOccurrence.findMany({
    where: { status: "SCHEDULED", endsAt: { gte: now }, event: { workspaceId, isPublic: true, status: "CONFIRMED" } },
    orderBy: { startsAt: "asc" },
    take: 200,
    select: { id: true, eventId: true, startsAt: true, event: { select: { title: true, venue: true, timezone: true } } },
  });
  const flat = rows.map((row) => ({ id: row.id, eventId: row.eventId, startsAt: row.startsAt, title: row.event.title, venue: row.event.venue, timezone: row.event.timezone }));
  return nextDatePerEvent(flat, LIST_LIMIT).map((row) => ({ id: row.id, title: row.title, venue: row.venue, startsAt: row.startsAt.toISOString(), timezone: row.timezone }));
}
