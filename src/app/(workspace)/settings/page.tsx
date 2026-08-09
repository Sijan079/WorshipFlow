import { redirect } from "next/navigation";
import { getDefaultWorkspaceSlug } from "@/lib/security-context";

export default function SettingsPage() {
  redirect(`/w/${encodeURIComponent(getDefaultWorkspaceSlug())}/settings`);
}
