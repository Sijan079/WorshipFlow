import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicSiteRoute, publicSiteMetadata } from "@/features/site/public/public-site-route";

export const revalidate = 60;

type Props = { params: Promise<{ workspaceSlug: string; pageSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, pageSlug } = await params;
  return publicSiteMetadata(workspaceSlug, pageSlug);
}

export default async function PublicInnerPage({ params }: Props) {
  const { workspaceSlug, pageSlug } = await params;
  // The home page lives at /c/{church}. Asking for it by name goes there, so it never exists as a second copy.
  if (pageSlug === "home") redirect(`/c/${workspaceSlug}`);
  return <PublicSiteRoute workspaceSlug={workspaceSlug} pageSlug={pageSlug} />;
}
