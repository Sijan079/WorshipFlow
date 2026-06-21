import { Prisma } from "@prisma/client";
export { getServiceBlockOrder } from "@/lib/service-display";

export const serviceDetailInclude = Prisma.validator<Prisma.WorshipServiceInclude>()({
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
});

export const serviceListInclude = Prisma.validator<Prisma.WorshipServiceInclude>()({
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
});

export type ServiceDetailPayload = Prisma.WorshipServiceGetPayload<{
  include: typeof serviceDetailInclude;
}>;

export type ServiceListPayload = Prisma.WorshipServiceGetPayload<{
  include: typeof serviceListInclude;
}>;

export type SongRepositoryItem = Prisma.SongGetPayload<{
  include: {
    files: true;
  };
}>;
