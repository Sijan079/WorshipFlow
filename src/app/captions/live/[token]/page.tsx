import type { Metadata } from "next";
import CaptionViewer from "@/features/sermon-captions/caption-viewer";

export const metadata: Metadata = { title: "Live English captions", robots: { index: false, follow: false } };

export default async function CaptionViewerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CaptionViewer token={token} />;
}
