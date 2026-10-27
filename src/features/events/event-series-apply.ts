import type { Prisma } from "@prisma/client";
import type { SeriesPlan } from "./event-series";

// Applies a plan from buildSeriesPlan inside the caller's transaction. Every id in the plan was read from
// this event's own occurrences, and removals are still limited to the event as a second guard.
export async function applySeriesPlan(tx: Prisma.TransactionClient, eventId: string, plan: SeriesPlan) {
  if (plan.remove.length > 0) {
    await tx.churchEventOccurrence.deleteMany({ where: { eventId, id: { in: plan.remove }, edited: false } });
  }
  for (const row of plan.update) {
    await tx.churchEventOccurrence.updateMany({ where: { id: row.id, eventId, edited: false }, data: { startsAt: row.startsAt, endsAt: row.endsAt } });
  }
  if (plan.create.length > 0) {
    await tx.churchEventOccurrence.createMany({
      data: plan.create.map((row) => ({ eventId, localDate: row.localDate, startsAt: row.startsAt, endsAt: row.endsAt })),
    });
  }
}
