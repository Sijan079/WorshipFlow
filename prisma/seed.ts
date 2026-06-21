import "dotenv/config";
import { PrismaClient, BlockType, SongRole, ServiceStatus, ServiceVariant, type WorshipServiceBlock } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { upsertDefaultSongTagPresets } from "./song-tag-defaults";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cleaning up database...");
  await prisma.serviceBibleVerse.deleteMany();
  await prisma.serviceServantAssignment.deleteMany();
  await prisma.serviceHymnal.deleteMany();
  await prisma.worshipServiceDetail.deleteMany();
  await prisma.blockPerson.deleteMany();
  await prisma.worshipServiceSong.deleteMany();
  await prisma.worshipServiceBlock.deleteMany();
  await prisma.worshipService.deleteMany();
  await prisma.songFile.deleteMany();
  await prisma.song.deleteMany();

  console.log("Seeding song editor tag presets...");
  const workspace = await upsertDefaultSongTagPresets(prisma);

  console.log("Seeding songs repository...");
  const song1 = await prisma.song.create({
    data: {
      workspaceId: workspace.id,
      title: "Sa Mga Pangako'y Umaasa",
      author: "Traditional",
      defaultKey: "G",
      bpm: 92,
      language: "Tagalog",
      isOriginal: false,
    },
  });

  const song2 = await prisma.song.create({
    data: {
      workspaceId: workspace.id,
      title: "Tunay Kang Matapat",
      author: "Traditional",
      defaultKey: "D",
      bpm: 80,
      language: "Tagalog",
      isOriginal: false,
    },
  });

  const song3 = await prisma.song.create({
    data: {
      workspaceId: workspace.id,
      title: "Amazing Grace",
      author: "John Newton",
      defaultKey: "F",
      bpm: 75,
      language: "English",
      isOriginal: false,
    },
  });

  console.log("Seeding worship service (Ladies Ministry)...");
  const service = await prisma.worshipService.create({
    data: {
      workspaceId: workspace.id,
      serviceDate: new Date("2026-05-24T09:00:00.000Z"),
      assignedMinistry: "LADIES",
      sermonVerse: "Hebrews 11:29-40",
      ministryName: "Ladies Ministry",
      theme: "Serving God with Faithful Hearts",
      status: ServiceStatus.READY,
      serviceVariant: ServiceVariant.STANDARD,
      templateType: "REGULAR",
    },
  });

  await prisma.serviceBibleVerse.createMany({
    data: [
      { serviceId: service.id, verse: "Awit 113:1-6", order: 0 },
      { serviceId: service.id, verse: "Hebrews 11:29-40", order: 1 },
    ],
  });

  await prisma.serviceServantAssignment.createMany({
    data: [
      { serviceId: service.id, role: "CALL_TO_WORSHIP", personName: "Ptr. Darwin" },
      { serviceId: service.id, role: "EMCEE", personName: "Sis. Marichu Supan" },
      { serviceId: service.id, role: "SCRIPTURE_READER", personName: "Sis. Tes Lalu" },
      { serviceId: service.id, role: "SERMON_SPEAKER", personName: "Ptr. Jay" },
      { serviceId: service.id, role: "OFFERING", personName: "Sis. Maritess Baldonaza / Sis. Kim De Jesus" },
    ],
  });

  await prisma.serviceHymnal.createMany({
    data: [
      { serviceId: service.id, role: "HYMN_OF_PREPARATION", title: "Sa Mga Pangako'y Umaasa" },
      { serviceId: service.id, role: "HYMN_OF_RESPONSE", title: "Tunay Kang Matapat" },
    ],
  });

  console.log("Seeding service blocks in strict order...");
  const blockTypes = [
    BlockType.CALL_TO_WORSHIP,
    BlockType.PRAISE_AND_WORSHIP,
    BlockType.MC,
    BlockType.AWIT_NG_PAKIKINIG,
    BlockType.SCRIPTURE_READING,
    BlockType.SERMON,
    BlockType.AWIT_NG_PAGTUGON,
    BlockType.OFFERING,
    BlockType.FLOWERS_FOR_THE_LORD,
  ];

  const blocks: Partial<Record<BlockType, WorshipServiceBlock>> = {};
  const requireBlock = (blockType: BlockType) => {
    const block = blocks[blockType];
    if (!block) {
      throw new Error(`Block ${blockType} was not created.`);
    }

    return block;
  };

  for (let i = 0; i < blockTypes.length; i++) {
    const type = blockTypes[i];
    const block = await prisma.worshipServiceBlock.create({
      data: {
        serviceId: service.id,
        blockType: type,
        order: i,
      },
    });
    blocks[type] = block;
  }

  // 1. CALL_TO_WORSHIP details
  console.log("Adding Call To Worship data...");
  await prisma.blockPerson.create({
    data: {
      blockId: requireBlock(BlockType.CALL_TO_WORSHIP).id,
      personName: "Ptr. Darwin",
      personTitle: "Preacher",
      order: 0,
    },
  });
  await prisma.worshipServiceDetail.create({
    data: {
      serviceId: service.id,
      blockId: requireBlock(BlockType.CALL_TO_WORSHIP).id,
      key: "Call To Worship Verse",
      value: "Awit 113:1-6",
    },
  });

  // 2. PRAISE_AND_WORSHIP
  console.log("Adding Praise and Worship data...");
  await prisma.worshipServiceSong.create({
    data: {
      serviceId: service.id,
      blockId: requireBlock(BlockType.PRAISE_AND_WORSHIP).id,
      songId: song3.id,
      order: 0,
      songRole: SongRole.OPENING,
      pageRef: "p.1",
    },
  });

  // 3. Papuri At Pasasalamat
  console.log("Adding Papuri At Pasasalamat data...");
  await prisma.blockPerson.create({
    data: {
      blockId: requireBlock(BlockType.MC).id,
      personName: "Sis. Marichu Supan",
      personTitle: "Papuri At Pasasalamat",
      order: 0,
    },
  });

  // 4. AWIT_NG_PAKIKINIG
  console.log("Adding Awit ng Pakikinig data...");
  await prisma.worshipServiceSong.create({
    data: {
      serviceId: service.id,
      blockId: requireBlock(BlockType.AWIT_NG_PAKIKINIG).id,
      songId: song1.id,
      order: 0,
      songRole: SongRole.SPECIAL,
      pageRef: "p.3",
    },
  });

  // 5. SCRIPTURE_READING
  console.log("Adding Scripture Reading data...");
  await prisma.blockPerson.create({
    data: {
      blockId: requireBlock(BlockType.SCRIPTURE_READING).id,
      personName: "Sis. Tes Lalu",
      personTitle: "Scripture Reader",
      order: 0,
    },
  });
  await prisma.worshipServiceDetail.create({
    data: {
      serviceId: service.id,
      blockId: requireBlock(BlockType.SCRIPTURE_READING).id,
      key: "Bible Reading",
      value: "Hebrews 11:29-40",
    },
  });

  // 6. SERMON
  console.log("Adding Sermon data...");
  await prisma.blockPerson.create({
    data: {
      blockId: requireBlock(BlockType.SERMON).id,
      personName: "Ptr. Jay",
      personTitle: "Preacher",
      order: 0,
    },
  });

  // 7. AWIT_NG_PAGTUGON
  console.log("Adding Awit ng Pagtugon data...");
  await prisma.worshipServiceSong.create({
    data: {
      serviceId: service.id,
      blockId: requireBlock(BlockType.AWIT_NG_PAGTUGON).id,
      songId: song2.id,
      order: 0,
      songRole: SongRole.RESPONSE,
      pageRef: "p.160",
    },
  });

  // 8. OFFERING
  console.log("Adding Offering data...");
  await prisma.blockPerson.create({
    data: {
      blockId: requireBlock(BlockType.OFFERING).id,
      personName: "Sis. Maritess Baldonaza",
      personTitle: "Offering Collector",
      order: 0,
    },
  });
  await prisma.blockPerson.create({
    data: {
      blockId: requireBlock(BlockType.OFFERING).id,
      personName: "Sis. Kim De Jesus",
      personTitle: "Offering Collector",
      order: 1,
    },
  });

  // 9. ANNOUNCEMENTS
  console.log("Adding Announcements data...");
  await prisma.worshipServiceDetail.create({
    data: {
      serviceId: service.id,
      blockId: requireBlock(BlockType.FLOWERS_FOR_THE_LORD).id,
      key: "Announcements",
      value: "Ensure announcements are reviewed before projection.",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
