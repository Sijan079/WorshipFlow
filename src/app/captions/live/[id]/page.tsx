import type { Metadata } from "next";
import CaptionViewer from "@/features/sermon-captions/caption-viewer";

export const metadata: Metadata = { title: "Live English captions · WorshipFlow", robots: { index: false, follow: false } };

export default async function CaptionViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaptionViewer sessionId={id} />;
}
