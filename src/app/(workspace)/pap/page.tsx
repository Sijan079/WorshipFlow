import PAPDesktopClient from "@/features/pap/components/pap-desktop-client";
import { PAPDesktopSessionProvider } from "@/features/pap/components/pap-desktop-session-provider";

export default function PAPPage() {
  return (
    <PAPDesktopSessionProvider>
      <PAPDesktopClient />
    </PAPDesktopSessionProvider>
  );
}
