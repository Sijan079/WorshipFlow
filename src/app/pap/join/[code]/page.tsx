import PAPMobileClient from "@/features/pap/components/pap-mobile-client";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function PAPJoinPage({ params }: PageProps) {
  const { code } = await params;
  return <PAPMobileClient pairingCode={code} />;
}
