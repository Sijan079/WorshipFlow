import WorkspaceShell from "@/components/workspace-shell";
import CaptionEngineProvider from "@/features/sermon-captions/caption-engine";

export default async function WorkspaceSlugLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}>) {
  const { workspaceSlug } = await params;
  return (
    <CaptionEngineProvider workspaceSlug={workspaceSlug}>
      <WorkspaceShell workspaceSlug={workspaceSlug}>{children}</WorkspaceShell>
    </CaptionEngineProvider>
  );
}
