import type { SiteBlockInput } from "../blocks/block-validation.ts";

// The ready-made home page a new church starts from. It is an ordinary page: the church can change or delete
// any block. The words are plain and short on purpose.
export const STARTER_HOME_TITLE = "Welcome";

export const STARTER_HOME_BLOCKS: SiteBlockInput[] = [
  { type: "PARAGRAPH", content: { runs: [{ text: "You are welcome here. Come as you are." }], align: "left", size: "large" } },
  { type: "SERVICE_TIMES", content: { lines: ["Sunday 9:00 AM"] } },
  { type: "HEADING", content: { text: "What is happening", level: 2, align: "left" } },
  { type: "ANNOUNCEMENTS_LIST", content: {} },
  { type: "EVENTS_LIST", content: {} },
  { type: "HEADING", content: { text: "Find us", level: 2, align: "left" } },
  { type: "CONTACT", content: {} },
];
