import { Prisma } from "@prisma/client";
import { BlockType, ServiceVariant, type BlockType as BlockTypeValue, type ServiceVariant as ServiceVariantValue } from "@/lib/service-constants";

export const STANDARD_BLOCK_ORDER: readonly BlockTypeValue[] = [
  BlockType.CALL_TO_WORSHIP,
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.MC,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.SCRIPTURE_READING,
  BlockType.SERMON,
  BlockType.AWIT_NG_PAGTUGON,
  BlockType.OFFERING,
  BlockType.FLOWERS_FOR_THE_LORD,
] as const;

export const EXTENDED_BLOCK_ORDER: readonly BlockTypeValue[] = [
  BlockType.CALL_TO_WORSHIP,
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.MC,
  BlockType.AWIT_NG_HIMNO,
  BlockType.TIPAN_PAHAYAG,
  BlockType.AWIT_NG_PAKIKINIG,
  BlockType.SCRIPTURE_READING,
  BlockType.SERMON,
  BlockType.AWIT_NG_PAGTUGON,
  BlockType.OFFERING,
  BlockType.FLOWERS_FOR_THE_LORD,
] as const;

export const STRICT_BLOCK_ORDER = STANDARD_BLOCK_ORDER;

export function getServiceBlockOrder(serviceVariant?: ServiceVariantValue | null) {
  return serviceVariant === ServiceVariant.EXTENDED ? EXTENDED_BLOCK_ORDER : STANDARD_BLOCK_ORDER;
}

export const BLOCK_LABELS: Record<BlockTypeValue, string> = {
  [BlockType.CALL_TO_WORSHIP]: "Call to Worship",
  [BlockType.PRAISE_AND_WORSHIP]: "Praise & Worship",
  [BlockType.MC]: "Papuri At Pasasalamat",
  [BlockType.AWIT_NG_HIMNO]: "Awit ng Himno",
  [BlockType.TIPAN_PAHAYAG]: "Tipan/Pahayag",
  [BlockType.AWIT_NG_PAKIKINIG]: "Awit ng Pakikinig",
  [BlockType.SCRIPTURE_READING]: "Scripture Reading",
  [BlockType.SERMON]: "Sermon",
  [BlockType.AWIT_NG_PAGTUGON]: "Awit ng Pagtugon",
  [BlockType.OFFERING]: "Offering",
  [BlockType.FLOWERS_FOR_THE_LORD]: "Announcements",
  [BlockType.DETAILS]: "Details",
};

export const SONG_BLOCK_TYPES = new Set<BlockTypeValue>([
  BlockType.PRAISE_AND_WORSHIP,
  BlockType.AWIT_NG_HIMNO,
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
