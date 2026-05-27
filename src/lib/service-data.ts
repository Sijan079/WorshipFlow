import { BlockType, Prisma } from "@prisma/client";

export const STRICT_BLOCK_ORDER = [
  BlockType.CALL_TO_WORSHIP,
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.MC,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.SCRIPTURE_READING,
  BlockType.SERMON,
  BlockType.AWIT_NG_PAGTUGON,
  BlockType.OFFERING,
  BlockType.FLOWERS_FOR_THE_LORD,
  BlockType.DETAILS,
] as const;

export const BLOCK_LABELS: Record<BlockType, string> = {
  [BlockType.CALL_TO_WORSHIP]: "Call to Worship",
  [BlockType.PRAISE_AND_WORSHIP]: "Praise & Worship",
  [BlockType.MC]: "MC",
  [BlockType.AWIT_NG_PAKIKINIG]: "Awit ng Pakikinig",
  [BlockType.SCRIPTURE_READING]: "Scripture Reading",
  [BlockType.SERMON]: "Sermon",
  [BlockType.AWIT_NG_PAGTUGON]: "Awit ng Pagtugon",
  [BlockType.OFFERING]: "Offering",
  [BlockType.FLOWERS_FOR_THE_LORD]: "Flowers for the Lord",
  [BlockType.DETAILS]: "Details",
};

export const SONG_BLOCK_TYPES = new Set<BlockType>([
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.AWIT_NG_PAGTUGON,
]);

export const serviceDetailInclude = Prisma.validator<Prisma.WorshipServiceInclude>()({
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
  assets: {
    orderBy: {
      createdAt: "desc",
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

export type ServiceDetailPayload = Prisma.WorshipServiceGetPayload<{
  include: typeof serviceDetailInclude;
}>;

export type SongRepositoryItem = Prisma.SongGetPayload<{
  include: {
    files: true;
  };
}>;
