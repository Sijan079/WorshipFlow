-- CreateTable
CREATE TABLE "CaptionBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "units" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptionBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptionBalanceSnapshot_day_units_key" ON "CaptionBalanceSnapshot"("day", "units");
