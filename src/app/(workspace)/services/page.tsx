import ServicesPageClient from "@/components/services-page-client";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";

export default async function ServicesPage() {
  const workspaceId = await getActiveWorkspaceId(prisma);
  const initialServices = await prisma.worshipService.findMany({
    where: { workspaceId },
    orderBy: {
      serviceDate: "asc",
    },
    include: {
      bibleVerses: {
        orderBy: {
          order: "asc",
        },
      },
      servantAssignments: {
        orderBy: {
          role: "asc",
        },
      },
      hymnals: {
        orderBy: {
          role: "asc",
        },
      },
    },
  });

  return <ServicesPageClient initialServices={JSON.parse(JSON.stringify(initialServices))} />;
}
