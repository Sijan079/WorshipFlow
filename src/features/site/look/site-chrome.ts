// Small rules for the header and the footer of the public site.

const SERVICE_TIME_LINES = 10;

// The church's main address for the home page, and a sub-address for any other page.
export function pageHref(churchSlug: string, pageSlug: string) {
  return pageSlug === "home" ? `/c/${churchSlug}` : `/c/${churchSlug}/${pageSlug}`;
}

// The call-to-action button in the header needs both its words and a page to open. When the menu is given, the page
// must be one a visitor can reach, so the header never links to a page that is not published.
export function headerButton(
  setting: { label: string | null; slug: string | null },
  churchSlug: string,
  menu?: Array<{ slug: string }>,
) {
  const label = setting.label?.trim();
  if (!label || !setting.slug) return null;
  if (menu && !menu.some((item) => item.slug === setting.slug)) return null;
  return { label, href: pageHref(churchSlug, setting.slug) };
}

// The footer's service times: one per line, trimmed, blank lines dropped, at most ten.
export function footerServiceTimes(text: string | null) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, SERVICE_TIME_LINES);
}
