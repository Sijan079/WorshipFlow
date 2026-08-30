import { notFound, redirect } from "next/navigation";
import ServiceBuilderClient from "@/components/service-builder-client";
import ServicesPageClient from "@/components/services-page-client";
import SettingsPageClient from "@/components/settings-page-client";
import TeamsPageClient from "@/components/teams-page-client";
import WorshipServicePlannerClient from "@/components/worship-service-planner-client";
import PAPDesktopClient from "@/features/pap/components/pap-desktop-client";
import ErrorNotificationsPage from "@/components/error-notifications-page";
import { MEDIA_TOOLS_MODULE } from "@/lib/workspace-modules";
import { getEnvironmentReport } from "@/lib/server-env";

type PageProps = {
  params: Promise<{ workspaceSlug: string; path?: string[] }>;
};

export default async function WorkspacePathPage({ params }: PageProps) {
  const { workspaceSlug, path = [] } = await params;
  const route = path.join("/");

  switch (route) {
    case "":
    case "dashboard":
      return <WorshipServicePlannerClient />;
    case "services":
      return <ServicesPageClient />;
    case "teams":
      return <TeamsPageClient />;
    case "song-formatter/upload":
    case "song-formatter/format":
      return <ServiceBuilderClient module="songs" />;
    case "songs":
    case "songs/upload":
      redirect(`/w/${encodeURIComponent(workspaceSlug)}/song-formatter/upload`);
    case "songs/format":
      redirect(`/w/${encodeURIComponent(workspaceSlug)}/song-formatter/format`);
    case "songs/library":
    case "songs/extraction":
      redirect(`/w/${encodeURIComponent(workspaceSlug)}/song-formatter/upload`);
    case "settings":
      return <SettingsPageClient environment={getEnvironmentReport()} />;
    case "notifications":
      return <ErrorNotificationsPage />;
    case "automation":
      return <ServiceBuilderClient module="automation" />;
    case "media-tools":
      return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} />;
    case "media-tools/phone-transfer":
      return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="phone-transfer" />;
    case "media-tools/qr-generator":
      return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="qr-generator" />;
    case "media-tools/background-generator":
      return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="background-generator" />;
    case "media-tools/resize-image":
      return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="resize-image" />;
    case "media-tools/background-removal":
      return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="background-removal" />;
    case "pap":
      return <PAPDesktopClient />;
    default:
      notFound();
  }
}
