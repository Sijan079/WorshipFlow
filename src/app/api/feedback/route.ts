import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { rateLimitResponse } from "@/lib/rate-limit";
import { requireAuthenticatedUser } from "@/lib/security-context";
import { FeedbackSubmissionSchema } from "@/lib/validation";

class FeedbackRateLimitError extends Error {
  constructor(readonly resetAt: Date) {
    super("Feedback report rate limit reached.");
  }
}

function getWindowStart(now: Date, scope: "HOUR" | "DAY") {
  const start = new Date(now);
  if (scope === "HOUR") {
    start.setUTCMinutes(0, 0, 0);
  } else {
    start.setUTCHours(0, 0, 0, 0);
  }
  return start;
}

async function consumeFeedbackRateLimit(
  tx: Prisma.TransactionClient,
  userId: string,
  scope: "HOUR" | "DAY",
  windowStart: Date,
  limit: number,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "FeedbackRateLimit" ("id", "userId", "scope", "windowStart", "count")
    VALUES (${crypto.randomUUID()}, ${userId}, ${scope}, ${windowStart}, 1)
    ON CONFLICT ("userId", "scope", "windowStart") DO UPDATE
    SET "count" = "FeedbackRateLimit"."count" + 1
    WHERE "FeedbackRateLimit"."count" < ${limit}
    RETURNING "id"
  `);
  return rows.length > 0;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = FeedbackSubmissionSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("Feedback report is not configured.", { kind: parsed.data.kind });
      return NextResponse.json({ error: "Reporting is not configured yet." }, { status: 503 });
    }

    const now = new Date();
    const hourStart = getWindowStart(now, "HOUR");
    const dayStart = getWindowStart(now, "DAY");
    try {
      await prisma.$transaction(async (tx) => {
        if (!await consumeFeedbackRateLimit(tx, user.id, "HOUR", hourStart, 3)) {
          throw new FeedbackRateLimitError(new Date(hourStart.getTime() + 60 * 60 * 1000));
        }
        if (!await consumeFeedbackRateLimit(tx, user.id, "DAY", dayStart, 10)) {
          throw new FeedbackRateLimitError(new Date(dayStart.getTime() + 24 * 60 * 60 * 1000));
        }
      });
    } catch (error) {
      if (error instanceof FeedbackRateLimitError) {
        console.warn("Feedback report rate limited.", { kind: parsed.data.kind });
        return rateLimitResponse(error.resetAt.getTime());
      }
      throw error;
    }

    const response = await fetch("https://api.github.com/repos/Sijan079/WorshipFlow/issues", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: `${parsed.data.kind === "ISSUE" ? "Issue" : "Feedback"} from ${user.displayName || user.email}`,
        body: parsed.data.message,
        labels: [parsed.data.kind.toLowerCase()],
      }),
    });

    if (!response.ok) {
      console.error("GitHub feedback report failed.", {
        kind: parsed.data.kind,
        status: response.status,
        githubRequestId: response.headers.get("x-github-request-id"),
      });
      return NextResponse.json({ error: "Could not send report." }, { status: 502 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Feedback report failed unexpectedly.", {
      error: getErrorMessage(error, "Unknown error."),
    });
    return NextResponse.json({ error: getErrorMessage(error, "Failed to send feedback") }, { status: 500 });
  }
}
