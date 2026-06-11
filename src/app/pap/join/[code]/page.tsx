import PAPMobileClient from "@/features/pap/components/pap-mobile-client";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function PAPJoinPage({ params }: PageProps) {
  await params;
  return <PAPMobileClient />;
}
