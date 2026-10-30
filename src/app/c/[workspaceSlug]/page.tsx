import type { Metadata } from "next";
import { getPublicSite } from "@/features/site/public/public-site-data";
import { PublicSiteView } from "@/features/site/public/public-site-view";

// Cached and rebuilt at most once a minute, so a busy Sunday costs the database one read a minute.
export const revalidate = 60;

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getPublicSite((await params).workspaceSlug);
  if (!site) return { title: "Page not available", robots: { index: false, follow: false } };
  // Unlisted by default: asking crawlers to skip the page unless the church turned indexing on.
  return { title: site.churchName, robots: site.indexable ? { index: true, follow: true } : { index: false, follow: false } };
}

export default async function PublicSitePage({ params }: Props) {
  const { workspaceSlug } = await params;
  const site = await getPublicSite(workspaceSlug);
  if (!site) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">This page is not available</h1>
        <p className="mt-4 text-lg">The church has not published its website yet.</p>
      </main>
    );
  }
  return <PublicSiteView site={site} churchSlug={workspaceSlug} />;
}
