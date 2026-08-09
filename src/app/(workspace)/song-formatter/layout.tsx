import ServiceBuilderClient from "@/components/service-builder-client";

export default function SongFormatterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ServiceBuilderClient module="songs" />
    </>
  );
}
