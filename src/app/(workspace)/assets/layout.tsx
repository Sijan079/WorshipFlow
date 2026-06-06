import { PAPDesktopSessionProvider } from "@/features/pap/components/pap-desktop-session-provider";

export default function AssetsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PAPDesktopSessionProvider>{children}</PAPDesktopSessionProvider>;
}
