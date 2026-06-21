import { Prisma } from "@prisma/client";
export { getServiceBlockOrder } from "@/lib/service-display";

export const serviceDetailArgs = Prisma.validator<Prisma.WorshipServiceDefaultArgs>()({
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
    blocks: {
      orderBy: {
        order: "asc",
      },
      include: {
        people: {
          orderBy: {
            order: "asc",
          },
        },
        songs: {
          orderBy: {
            order: "asc",
          },
          include: {
            song: true,
          },
        },
        details: {
          orderBy: {
            key: "asc",
          },
        },
      },
    },
    details: {
      orderBy: {
        key: "asc",
      },
    },
    jobs: {
      orderBy: {
        createdAt: "desc",
      },
      include: {
        outputs: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    },
    outputs: {
      orderBy: {
        createdAt: "desc",
      },
    },
  },
});

export const serviceDetailInclude = serviceDetailArgs.include;

export const serviceListRelations = Prisma.validator<Prisma.WorshipServiceDefaultArgs>()({
  include: {
    bibleVerses: true,
    servantAssignments: true,
    hymnals: true,
  },
});

export type ServiceDetailPayload = Prisma.WorshipServiceGetPayload<typeof serviceDetailArgs>;

export type ServiceListPayload = Prisma.WorshipServiceGetPayload<typeof serviceListRelations>;

export type SongRepositoryItem = Prisma.SongGetPayload<{
  include: {
    files: true;
  };
}>;
