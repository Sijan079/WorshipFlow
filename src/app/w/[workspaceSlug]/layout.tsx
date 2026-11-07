import { cookies } from "next/headers";
import WorkspaceShell from "@/components/workspace-shell";
import CaptionEngineProvider from "@/features/sermon-captions/caption-engine";
import { ACCENT_THEME_COOKIE, parseAccentTheme } from "@/lib/accent-theme";

export default async function WorkspaceSlugLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}>) {
  const { workspaceSlug } = await params;
  // The cookie is checked against the allowed themes; anything else is Indigo. tokens.css keys the Teal
  // palette on this marker, so dialogs and menus outside the page follow it too.
  const accentTheme = parseAccentTheme((await cookies()).get(ACCENT_THEME_COOKIE)?.value);
  return (
    <CaptionEngineProvider workspaceSlug={workspaceSlug}>
      <span hidden data-app-theme={accentTheme} />
      <WorkspaceShell workspaceSlug={workspaceSlug}>{children}</WorkspaceShell>
    </CaptionEngineProvider>
  );
}
