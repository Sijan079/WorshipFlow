-- One row that a daily job stamps, so a Supabase Free project sees regular database activity and
-- is not paused. It holds no church data.
CREATE TABLE "KeepAlive" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeepAlive_pkey" PRIMARY KEY ("id")
);

-- Browser clients do not access this Prisma-owned table through the Supabase Data API.
ALTER TABLE "KeepAlive" ENABLE ROW LEVEL SECURITY;
