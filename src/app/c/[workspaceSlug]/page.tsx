import type { Metadata } from "next";
import { PublicSiteRoute, publicSiteMetadata } from "@/features/site/public/public-site-route";

// Cached and rebuilt at most once a minute, so a busy Sunday costs the database one read a minute.
export const revalidate = 60;

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return publicSiteMetadata((await params).workspaceSlug, "home");
}

export default async function PublicHomePage({ params }: Props) {
  return <PublicSiteRoute workspaceSlug={(await params).workspaceSlug} pageSlug="home" />;
}
