import WorkspaceShell from "@/components/workspace-shell";

export default async function WorkspaceSlugLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}>) {
  const { workspaceSlug } = await params;
  return <WorkspaceShell workspaceSlug={workspaceSlug}>{children}</WorkspaceShell>;
}
