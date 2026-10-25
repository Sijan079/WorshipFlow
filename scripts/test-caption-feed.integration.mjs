// Run with the dev server and hosted development environment configured.
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let sessionId;

try {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { status: "ACTIVE" }, select: { workspaceId: true, userId: true },
  });
  assert.ok(membership, "An active workspace member is required for the feed test.");
  const active = await prisma.captionSession.count({ where: { workspaceId: membership.workspaceId, status: "LIVE" } });
  assert.equal(active, 0, "Do not run the feed test while a live caption session exists.");
  const session = await prisma.captionSession.create({
    data: {
      workspaceId: membership.workspaceId,
      operatorUserId: membership.userId,
      operatorTokenHash: "test-only",
      expiresAt: new Date(Date.now() + 60_000),
      lines: { create: Array.from({ length: 12 }, (_, index) => ({
        line: index + 1,
        source: `Kumusta ${index + 1}`,
        english: `Hello ${index + 1}`,
        final: true,
      })) },
    },
  });
  sessionId = session.id;
  const url = `http://localhost:3000/api/captions/live/${sessionId}`;
  const connectingResponse = await fetch(url);
  assert.equal(connectingResponse.status, 200);
  const connecting = await connectingResponse.json();
  assert.equal(connecting.status, "connecting");
  await prisma.captionSession.update({ where: { id: sessionId }, data: { connectionStatus: "STREAMING", lastHeartbeatAt: new Date(), connectionSequence: 1 } });
  const liveResponse = await fetch(url);
  assert.equal(liveResponse.status, 200);
  const live = await liveResponse.json();
  assert.equal(live.status, "live");
  assert.deepEqual(live.lines, Array.from({ length: 10 }, (_, index) => ({
    line: 12 - index,
    english: `Hello ${12 - index}`,
    final: true,
  })));
  assert.equal(JSON.stringify(live).includes("Kumusta"), false, "The public feed must not expose source text.");
  await prisma.captionSession.update({ where: { id: sessionId }, data: { lastHeartbeatAt: new Date(Date.now() - 20_000) } });
  const interruptedResponse = await fetch(url);
  assert.equal((await interruptedResponse.json()).status, "interrupted");
  await prisma.captionSession.update({ where: { id: sessionId }, data: { connectionStatus: "ERROR", lastHeartbeatAt: new Date(), connectionSequence: 2 } });
  const errorResponse = await fetch(url);
  assert.equal((await errorResponse.json()).status, "error");
  const stoppedAt = new Date();
  const availableUntil = new Date(stoppedAt.getTime() + 60 * 60 * 1000);
  await prisma.captionSession.update({ where: { id: sessionId }, data: { status: "ENDED", endedAt: stoppedAt, expiresAt: availableUntil } });
  const endedResponse = await fetch(url);
  assert.equal(endedResponse.status, 200);
  assert.deepEqual(await endedResponse.json(), { status: "ended", expiresAt: availableUntil.toISOString(), lines: live.lines });
  await prisma.captionSession.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expiredResponse = await fetch(url);
  assert.equal(expiredResponse.status, 200);
  assert.deepEqual(await expiredResponse.json(), { status: "ended", lines: [] });
  assert.equal(await prisma.captionLine.count({ where: { sessionId } }), 0, "Expired captions should be deleted from storage.");
  console.log("Caption feed integration passed: connecting, live, interrupted, error, retained, and expired states.");
} finally {
  if (sessionId) await prisma.captionSession.delete({ where: { id: sessionId } });
  await prisma.$disconnect();
  await pool.end();
}
