import prisma from "@/lib/prisma";
import { isPubliclyVisible } from "@/features/posts/post-rules";
import { SiteBlockSchema, type SiteBlockInput } from "@/features/site/blocks/block-validation";
import { nextDatePerEvent } from "./public-events";

// The only door the public site (/c/{slug}) reads through. It returns a small set of public-safe fields and
// never touches People, Ministry, attendance or service-assignment data. The privacy test checks this folder.

type Listed = "ANNOUNCEMENTS_LIST" | "EVENTS_LIST" | "CONTACT";
type Shown = Exclude<SiteBlockInput, { type: Listed | "IMAGE" }>;

export type PublicBlock =
  | (Shown & { id: string })
  | { id: string; type: "ANNOUNCEMENTS_LIST"; items: Array<{ id: string; title: string; body: string }> }
  | { id: string; type: "EVENTS_LIST"; items: Array<{ id: string; title: string; venue: string | null; startsAt: string; timezone: string }> }
  | { id: string; type: "CONTACT"; email: string | null; phone: string | null; address: string | null };

export type PublicSite = {
  churchName: string;
  indexable: boolean;
  page: { title: string; blocks: PublicBlock[] };
};

const HOME_SLUG = "home";
const LIST_LIMIT = 10;

// Returns null when the church or its home page is not public, so the route can show one plain "not available"
// page and never reveal which of the two was missing.
export async function getPublicSite(workspaceSlug: string, now = new Date()): Promise<PublicSite | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true, siteSettings: { select: { indexable: true, contactEmail: true, contactPhone: true, address: true } } },
  });
  if (!workspace) return null;

  const page = await prisma.sitePage.findFirst({
    where: { workspaceId: workspace.id, slug: HOME_SLUG, status: "PUBLISHED", isPublic: true },
    select: { title: true, blocks: { orderBy: { sortOrder: "asc" }, select: { id: true, type: true, content: true } } },
  });
  if (!page) return null;

  const settings = workspace.siteSettings;
  const blocks: PublicBlock[] = [];
  for (const row of page.blocks) {
    // A stored block that no longer fits the rules is left out rather than shown half-broken.
    const parsed = SiteBlockSchema.safeParse({ type: row.type, content: row.content });
    if (!parsed.success) continue;
    const block = parsed.data;
    switch (block.type) {
      case "IMAGE":
        break; // Images arrive with the image upload piece.
      case "CONTACT":
        blocks.push({ id: row.id, type: "CONTACT", email: settings?.contactEmail ?? null, phone: settings?.contactPhone ?? null, address: settings?.address ?? null });
        break;
      case "ANNOUNCEMENTS_LIST":
        blocks.push({ id: row.id, type: "ANNOUNCEMENTS_LIST", items: await publicAnnouncements(workspace.id, now) });
        break;
      case "EVENTS_LIST":
        blocks.push({ id: row.id, type: "EVENTS_LIST", items: await publicEvents(workspace.id, now) });
        break;
      default:
        blocks.push({ ...block, id: row.id });
    }
  }

  return { churchName: workspace.name, indexable: settings?.indexable ?? false, page: { title: page.title, blocks } };
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
