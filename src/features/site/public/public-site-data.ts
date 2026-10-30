import prisma from "@/lib/prisma";
import { isPubliclyVisible } from "@/features/posts/post-rules";
import { SiteBlockSchema, type BaseBlockInput, type ColumnsBlockInput, type SectionChildInput, type SiteBlockInput } from "@/features/site/blocks/block-validation";
import { imageIdFromPath, imageIdsIn } from "@/features/site/images/image-refs";
import { HOME_SLUG, menuPages } from "@/features/site/pages/page-rules";
import { nextDatePerEvent } from "./public-events";
import { pageDescription } from "./page-description";

// The only door the public site (/c/{slug}) reads through. It returns a small set of public-safe fields and
// never touches People, Ministry, attendance or service-assignment data. The privacy test checks this folder.

type Listed = "ANNOUNCEMENTS_LIST" | "EVENTS_LIST" | "CONTACT";
type CoverInput = Extract<SiteBlockInput, { type: "COVER" }>["content"];
export type CoverFocus = CoverInput["focus"];
export type CoverButton = CoverInput["buttons"][number];
type Shown = Exclude<SiteBlockInput, { type: Listed | "IMAGE" | "SECTION" | "COVER" | "COLUMNS" }>;

export type PublicBlock =
  | (Shown & { id: string })
  | { id: string; type: "IMAGE"; src: string; alt: string; caption: string | null; align: "left" | "center"; width: "content" | "wide" | "full"; naturalWidth: number; naturalHeight: number }
  | { id: string; type: "SECTION"; background: "none" | "tinted" | "dark" | "accent" | "picture"; pictureSrc: string | null; overlay: "light" | "medium" | "strong"; padding: "small" | "medium" | "large"; inner: "content" | "wide"; width: "wide" | "full"; blocks: PublicBlock[] }
  | { id: string; type: "COLUMNS"; valign: "top" | "center"; cards: boolean; width: "content" | "wide" | "full"; columns: PublicBlock[][] }
  | { id: string; type: "COVER"; headline: string; text: string | null; pictureSrc: string | null; overlay: "light" | "medium" | "strong"; height: "medium" | "tall" | "screen"; align: "left" | "center"; focus: CoverFocus; width: "wide" | "full"; buttons: CoverButton[] }
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
  // A stored block that no longer fits the rules is left out rather than shown half-broken.
  const parsed: Array<{ id: string; block: SiteBlockInput }> = [];
  for (const row of rows) {
    const result = SiteBlockSchema.safeParse({ type: row.type, content: row.content });
    if (result.success) parsed.push({ id: row.id, block: result.data });
  }

  // Only pictures this church uploaded count, however a block spells its path. One lookup covers the whole page.
  const wanted = imageIdsIn(parsed.map((item) => item.block));
  const images = new Map(
    (wanted.length === 0 ? [] : await prisma.siteImage.findMany({ where: { workspaceId, id: { in: wanted } }, select: { id: true, width: true, height: true } })).map((image) => [image.id, image]),
  );

  const pictureFor = (path: string | undefined) => {
    const imageId = path ? imageIdFromPath(path) : null;
    const image = imageId ? images.get(imageId) : undefined;
    return imageId && image ? { imageId, image } : null;
  };

  async function resolveBase(block: BaseBlockInput, id: string): Promise<PublicBlock | null> {
    switch (block.type) {
      case "IMAGE": {
        const picture = pictureFor(block.content.path);
        if (!picture) return null;
        return { id, type: "IMAGE", src: imageSrc(picture.imageId), alt: block.content.alt, caption: block.content.caption?.trim() || null, align: block.content.align, width: block.content.width ?? "content", naturalWidth: picture.image.width, naturalHeight: picture.image.height };
      }
      case "CONTACT":
        return { id, type: "CONTACT", email: settings?.contactEmail ?? null, phone: settings?.contactPhone ?? null, address: settings?.address ?? null };
      case "ANNOUNCEMENTS_LIST":
        return { id, type: "ANNOUNCEMENTS_LIST", items: await publicAnnouncements(workspaceId, now) };
      case "EVENTS_LIST":
        return { id, type: "EVENTS_LIST", items: await publicEvents(workspaceId, now) };
      default:
        return { ...block, id };
    }
  }

  async function resolveColumns(block: ColumnsBlockInput, id: string): Promise<PublicBlock> {
    const columns: PublicBlock[][] = [];
    for (const [columnIndex, column] of block.content.columns.entries()) {
      const inner: PublicBlock[] = [];
      for (const [index, child] of column.blocks.entries()) {
        const resolved = await resolveBase(child, `${id}-${columnIndex}-${index}`);
        if (resolved) inner.push(resolved);
      }
      columns.push(inner);
    }
    return { id, type: "COLUMNS", valign: block.content.valign, cards: block.content.cards, width: block.content.width, columns };
  }

  const resolveChild = (child: SectionChildInput, id: string) => (child.type === "COLUMNS" ? resolveColumns(child, id) : resolveBase(child, id));

  async function resolve(block: SiteBlockInput, id: string): Promise<PublicBlock | null> {
    if (block.type === "COLUMNS") return resolveColumns(block, id);
    if (block.type === "COVER") {
      // A cover whose picture is gone, or that never had one, uses the church colour, so its words stay readable.
      const picture = pictureFor(block.content.picture);
      const { headline, text, overlay, height, align, focus, width, buttons } = block.content;
      return { id, type: "COVER", headline, text: text?.trim() || null, pictureSrc: picture ? imageSrc(picture.imageId) : null, overlay, height, align, focus, width, buttons };
    }
    if (block.type !== "SECTION") return resolveBase(block, id);
    const inner: PublicBlock[] = [];
    for (const [index, child] of block.content.blocks.entries()) {
      const resolved = await resolveChild(child, `${id}-${index}`);
      if (resolved) inner.push(resolved);
    }
    const picture = block.content.background === "picture" ? pictureFor(block.content.picture) : null;
    // A picture background whose picture is gone falls back to the dark band, so the words stay readable.
    const background = block.content.background === "picture" && !picture ? "dark" : block.content.background;
    return { id, type: "SECTION", background, pictureSrc: picture ? imageSrc(picture.imageId) : null, overlay: block.content.overlay, padding: block.content.padding, inner: block.content.inner, width: block.content.width, blocks: inner };
  }

  const blocks: PublicBlock[] = [];
  for (const item of parsed) {
    const resolved = await resolve(item.block, item.id);
    if (resolved) blocks.push(resolved);
  }
  return { blocks, parsed: parsed.map((item) => item.block) };
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
