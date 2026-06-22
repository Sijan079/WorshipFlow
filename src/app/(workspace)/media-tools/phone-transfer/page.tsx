import ServiceBuilderClient from "@/components/service-builder-client";
import { MEDIA_TOOLS_MODULE } from "@/lib/workspace-modules";

export default function PhoneTransferPage() {
  return <ServiceBuilderClient module={MEDIA_TOOLS_MODULE} mediaTool="phone-transfer" />;
}
