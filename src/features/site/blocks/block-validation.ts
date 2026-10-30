import { z } from "zod";

// What a page may contain. Content is structured data, never HTML: every object is strict, so an unknown field
// (html, color, style) is refused instead of stored.

export const SITE_LIMITS = {
  pagesPerChurch: 20,
  blocksPerPage: 60,
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

export const SiteBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("PARAGRAPH"), content: z.strictObject({ runs: z.array(RunSchema).max(SITE_LIMITS.runsPerParagraph), align, size: textSize }) }),
  z.strictObject({ type: z.literal("HEADING"), content: z.strictObject({ text: plain(200), level: z.union([z.literal(2), z.literal(3)]), align }) }),
  z.strictObject({ type: z.literal("LIST"), content: z.strictObject({ ordered: z.boolean(), items: z.array(plain(500)).max(SITE_LIMITS.listItems) }) }),
  z.strictObject({ type: z.literal("QUOTE"), content: z.strictObject({ text: plain(1000), cite: plain(200).optional() }) }),
  z.strictObject({
    type: z.literal("IMAGE"),
    content: z.strictObject({
      // Only a file in the site's own storage folder, so a block can never point at someone else's file or address.
      path: z.string().regex(/^site\/[A-Za-z0-9_-]+\.webp$/),
      alt: z.string().trim().min(1, "Describe the image.").max(300),
      caption: plain(300).optional(),
      align,
    }),
  }),
  z.strictObject({ type: z.literal("BUTTON"), content: z.strictObject({ label: z.string().trim().min(1).max(60), link: LinkSchema, align }) }),
  z.strictObject({ type: z.literal("SPACER"), content: z.strictObject({ size: z.enum(["small", "medium", "large"]) }) }),
  z.strictObject({ type: z.literal("SERVICE_TIMES"), content: z.strictObject({ lines: z.array(plain(120)).max(10) }) }),
  z.strictObject({ type: z.literal("ANNOUNCEMENTS_LIST"), content: none }),
  z.strictObject({ type: z.literal("EVENTS_LIST"), content: none }),
  z.strictObject({ type: z.literal("CONTACT"), content: none }),
]);
export type SiteBlockInput = z.infer<typeof SiteBlockSchema>;

export const PageInputSchema = z.strictObject({
  title: z.string().trim().min(1, "Enter a page title.").max(SITE_LIMITS.titleMax),
  description: z.string().trim().max(SITE_LIMITS.descriptionMax).optional(),
  blocks: z.array(SiteBlockSchema).max(SITE_LIMITS.blocksPerPage),
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
