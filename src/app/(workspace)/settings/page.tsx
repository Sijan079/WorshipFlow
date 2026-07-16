import SettingsPageClient from "@/components/settings-page-client";
import { getEnvironmentReport } from "@/lib/server-env";

export default function SettingsPage() {
  return <SettingsPageClient environment={getEnvironmentReport()} />;
}
