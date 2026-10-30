import prisma from "@/lib/prisma";
import { isPubliclyVisible } from "@/features/posts/post-rules";

// The only door the public site (/c/{slug}) reads through. It returns a small set of public-safe fields and
// never touches People, Ministry, attendance or service-assignment data. The privacy test checks this folder.

export type PublicBlock =
  | { id: string; type: "HEADING"; text: string }
  | { id: string; type: "RICH_TEXT"; text: string }
  | { id: string; type: "SERVICE_TIMES"; lines: string[] }
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

function textOf(content: unknown, key: string) {
  if (content && typeof content === "object" && key in content) {
    const value = (content as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function linesOf(content: unknown) {
  const value = content && typeof content === "object" ? (content as Record<string, unknown>).lines : null;
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === "string" && line.trim() !== "") : [];
}

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
  for (const block of page.blocks) {
    if (block.type === "HEADING") blocks.push({ id: block.id, type: "HEADING", text: textOf(block.content, "text") });
    else if (block.type === "RICH_TEXT") blocks.push({ id: block.id, type: "RICH_TEXT", text: textOf(block.content, "text") });
    else if (block.type === "SERVICE_TIMES") blocks.push({ id: block.id, type: "SERVICE_TIMES", lines: linesOf(block.content) });
    else if (block.type === "CONTACT") {
      blocks.push({ id: block.id, type: "CONTACT", email: settings?.contactEmail ?? null, phone: settings?.contactPhone ?? null, address: settings?.address ?? null });
    } else if (block.type === "ANNOUNCEMENTS_LIST") {
      blocks.push({ id: block.id, type: "ANNOUNCEMENTS_LIST", items: await publicAnnouncements(workspace.id, now) });
    } else if (block.type === "EVENTS_LIST") {
      blocks.push({ id: block.id, type: "EVENTS_LIST", items: await publicEvents(workspace.id, now) });
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
  const rows = await prisma.churchEventOccurrence.findMany({
    where: { status: "SCHEDULED", endsAt: { gte: now }, event: { workspaceId, isPublic: true, status: "CONFIRMED" } },
    orderBy: { startsAt: "asc" },
    take: LIST_LIMIT,
    select: { id: true, startsAt: true, event: { select: { title: true, venue: true, timezone: true } } },
  });
  return rows.map((row) => ({ id: row.id, title: row.event.title, venue: row.event.venue, startsAt: row.startsAt.toISOString(), timezone: row.event.timezone }));
}
