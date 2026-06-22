import ServiceBuilderClient from "@/components/service-builder-client";
import { MEDIA_TOOLS_MODULE } from "@/lib/workspace-modules";

export default function BackgroundGeneratorPage() {
  return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="background-generator" />;
}
