CREATE TABLE "FeedbackRateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeedbackRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedbackRateLimit_userId_scope_windowStart_key"
  ON "FeedbackRateLimit"("userId", "scope", "windowStart");

ALTER TABLE "FeedbackRateLimit" ADD CONSTRAINT "FeedbackRateLimit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
