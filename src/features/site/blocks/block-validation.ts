import { z } from "zod";

// What a page may contain. Content is structured data, never HTML: every object is strict, so an unknown field
// (html, color, style) is refused instead of stored.

export const SITE_LIMITS = {
  pagesPerChurch: 20,
  // Counted at every level: a Section and the blocks inside it all count.
  blocksPerPage: 100,
  sectionBlocks: 30,
  columnBlocks: 15,
  titleMax: 80,
  descriptionMax: 300,
  runsPerParagraph: 200,
  listItems: 50,
} as const;

const SAFE_PROTOCOLS = new Set(["http:", "https:", "tel:", "mailto:"]);
const PAGE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return false;
    return url.protocol === "http:" || url.protocol === "https:" ? url.hostname !== "" : true;
  } catch {
    return false;
  }
}

// A link goes to another page of the same site, or to an outside address with one of four safe protocols.
export const LinkSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("page"), slug: z.string().regex(PAGE_SLUG).max(80) }),
  z.strictObject({ kind: z.literal("url"), url: z.string().trim().max(2000).refine(isSafeUrl, "Use a web, phone or email address.") }),
]);
export type SiteLink = z.infer<typeof LinkSchema>;

const align = z.enum(["left", "center"]);
const textSize = z.enum(["normal", "large"]);

// The small allowed set of text styling: bold, italic and a link. Nothing else.
const RunSchema = z.strictObject({
  text: z.string().max(5000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  link: LinkSchema.optional(),
});
export type TextRun = z.infer<typeof RunSchema>;

const none = z.strictObject({});
const plain = (max: number) => z.string().max(max);

// Pictures: a stored file of the church's own, never an address. Only the church's pictures, checked again on save.
const imagePath = z.string().regex(/^site\/[A-Za-z0-9_-]+\.webp$/);

// Text blocks always sit at the reading width, so they take no width setting. Pictures, and the layout blocks, can
// be content width, wide or full.
const blockWidth = z.enum(["content", "wide", "full"]);

const paragraph = z.strictObject({ type: z.literal("PARAGRAPH"), content: z.strictObject({ runs: z.array(RunSchema).max(SITE_LIMITS.runsPerParagraph), align, size: textSize }) });
const heading = z.strictObject({ type: z.literal("HEADING"), content: z.strictObject({ text: plain(200), level: z.union([z.literal(2), z.literal(3)]), align }) });
const list = z.strictObject({ type: z.literal("LIST"), content: z.strictObject({ ordered: z.boolean(), items: z.array(plain(500)).max(SITE_LIMITS.listItems) }) });
const quote = z.strictObject({ type: z.literal("QUOTE"), content: z.strictObject({ text: plain(1000), cite: plain(200).optional() }) });
const image = z.strictObject({
  type: z.literal("IMAGE"),
  content: z.strictObject({
    path: imagePath,
    alt: z.string().trim().min(1, "Describe the image.").max(300),
    caption: plain(300).optional(),
    align,
    width: blockWidth.optional(),
  }),
});
const button = z.strictObject({ type: z.literal("BUTTON"), content: z.strictObject({ label: z.string().trim().min(1).max(60), link: LinkSchema, align }) });
const spacer = z.strictObject({ type: z.literal("SPACER"), content: z.strictObject({ size: z.enum(["small", "medium", "large"]) }) });
const serviceTimes = z.strictObject({ type: z.literal("SERVICE_TIMES"), content: z.strictObject({ lines: z.array(plain(120)).max(10) }) });
const announcementsList = z.strictObject({ type: z.literal("ANNOUNCEMENTS_LIST"), content: none });
const eventsList = z.strictObject({ type: z.literal("EVENTS_LIST"), content: none });
const contact = z.strictObject({ type: z.literal("CONTACT"), content: none });

// Every block that can sit inside a layout block. A layout block never holds another layout block of its own kind.
export const BaseBlockSchema = z.discriminatedUnion("type", [paragraph, heading, list, quote, image, button, spacer, serviceTimes, announcementsList, eventsList, contact]);
export type BaseBlockInput = z.infer<typeof BaseBlockSchema>;

// Two to four equal columns side by side (stacked on phones), each holding blocks. A column holds only ordinary
// blocks: no Columns inside a column, and no Section or Cover. The card look is one switch for all the columns.
const columns = z.strictObject({
  type: z.literal("COLUMNS"),
  content: z.strictObject({
    columns: z.array(z.strictObject({ blocks: z.array(BaseBlockSchema).max(SITE_LIMITS.columnBlocks) })).min(2).max(4),
    valign: z.enum(["top", "center"]),
    cards: z.boolean(),
    width: blockWidth,
  }),
});
export type ColumnsBlockInput = z.infer<typeof columns>;

// What a Section can hold: the ordinary blocks, and Columns.
const SectionChildSchema = z.discriminatedUnion("type", [paragraph, heading, list, quote, image, button, spacer, serviceTimes, announcementsList, eventsList, contact, columns]);
export type SectionChildInput = z.infer<typeof SectionChildSchema>;

// A full-width band that holds blocks. Colours come from the church's colour set, never from a free colour.
const section = z.strictObject({
  type: z.literal("SECTION"),
  content: z
    .strictObject({
      background: z.enum(["none", "tinted", "dark", "accent", "picture"]),
      picture: imagePath.optional(),
      overlay: z.enum(["light", "medium", "strong"]),
      padding: z.enum(["small", "medium", "large"]),
      inner: z.enum(["content", "wide"]),
      width: z.enum(["wide", "full"]),
      blocks: z.array(SectionChildSchema).max(SITE_LIMITS.sectionBlocks),
    })
    .refine((content) => content.background !== "picture" || Boolean(content.picture), { message: "Choose a picture for the background.", path: ["picture"] }),
});

// The nine places a picture can be anchored when it is cropped to fit.
export const COVER_FOCUS_POINTS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const;

// A hero: a picture (or the church colour) with a headline, a line of text and up to two buttons on top. It sits on
// the page itself, never inside a Section. The overlay can never be switched off, so white words stay readable.
const cover = z.strictObject({
  type: z.literal("COVER"),
  content: z.strictObject({
    headline: z.string().trim().min(1, "Write a headline for the cover.").max(120),
    text: plain(300).optional(),
    picture: imagePath.optional(),
    overlay: z.enum(["light", "medium", "strong"]),
    height: z.enum(["medium", "tall", "screen"]),
    align: align,
    focus: z.enum(COVER_FOCUS_POINTS),
    width: z.enum(["wide", "full"]),
    buttons: z.array(z.strictObject({ label: z.string().trim().min(1).max(60), link: LinkSchema, style: z.enum(["filled", "outline"]) })).max(2),
  }),
});

export const SiteBlockSchema = z.discriminatedUnion("type", [paragraph, heading, list, quote, image, button, spacer, serviceTimes, announcementsList, eventsList, contact, section, cover, columns]);
export type SiteBlockInput = z.infer<typeof SiteBlockSchema>;
export type SectionBlockInput = z.infer<typeof section>;
export type CoverBlockInput = z.infer<typeof cover>;

// Blocks at every level, a layout block counting once itself and once for each block inside it.
export function countBlocks(blocks: Array<{ type: string; content: unknown }>): number {
  let total = 0;
  for (const block of blocks) {
    total += 1;
    const content = block.content as { blocks?: unknown; columns?: unknown } | null;
    if (block.type === "SECTION" && Array.isArray(content?.blocks)) total += countBlocks(content.blocks as Array<{ type: string; content: unknown }>);
    if (block.type === "COLUMNS" && Array.isArray(content?.columns)) {
      for (const column of content.columns as Array<{ blocks?: unknown }>) {
        if (Array.isArray(column?.blocks)) total += countBlocks(column.blocks as Array<{ type: string; content: unknown }>);
      }
    }
  }
  return total;
}

export const PageInputSchema = z.strictObject({
  title: z.string().trim().min(1, "Enter a page title.").max(SITE_LIMITS.titleMax),
  description: z.string().trim().max(SITE_LIMITS.descriptionMax).optional(),
  blocks: z.array(SiteBlockSchema).max(SITE_LIMITS.blocksPerPage).refine((blocks) => countBlocks(blocks) <= SITE_LIMITS.blocksPerPage, { message: "A page can hold up to 100 blocks, counting the ones inside sections." }),
});
export type PageInput = z.infer<typeof PageInputSchema>;

// "Plan Your Visit" becomes "plan-your-visit". Accents are dropped, anything else becomes a dash.
export function pageSlugFromTitle(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "page";
}
