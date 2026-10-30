import type { Metadata } from "next";
import { getPublicSite } from "./public-site-data";
import { PublicSiteView } from "./public-site-view";

// What /c/{church} and /c/{church}/{page} share: the search tags, and the page or the one plain "not available" page.

export async function publicSiteMetadata(workspaceSlug: string, pageSlug: string): Promise<Metadata> {
  const site = await getPublicSite(workspaceSlug, pageSlug);
  if (!site) return { title: "Page not available", robots: { index: false, follow: false } };
  return {
    title: pageSlug === "home" ? site.churchName : `${site.page.title} | ${site.churchName}`,
    description: site.page.description ?? undefined,
    // Unlisted by default: asking crawlers to skip the page unless the church turned indexing on.
    robots: site.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export async function PublicSiteRoute({ workspaceSlug, pageSlug }: { workspaceSlug: string; pageSlug: string }) {
  const site = await getPublicSite(workspaceSlug, pageSlug);
  if (!site) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">This page is not available</h1>
        <p className="mt-4 text-lg">The church has not published this page yet.</p>
      </main>
    );
  }
  return <PublicSiteView site={site} churchSlug={workspaceSlug} />;
}
