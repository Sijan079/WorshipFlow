import ServiceBuilderClient from "@/components/service-builder-client";

export default function SongsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ServiceBuilderClient module="songs" />
    </>
  );
}
