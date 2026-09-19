import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.ts";
import { createFormatterDraft, changeFormatterDraft, cleanupFormatterDrafts, getFormatterDraft, recordFormatterFailure } from "../src/features/song-formatter/draft-store.ts";

test("temporary draft transactions preserve ownership, TTL and metadata-only history", async () => {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname), "Integration test is local-database only");
  const suffix = randomUUID();
  const workspace = await prisma.workspace.create({ data: { slug: `draft-test-${suffix}`, name: "Draft integration test" } });
  const user = await prisma.user.create({ data: { authProviderId: `draft-test-${suffix}`, email: `${suffix}@example.invalid`, displayName: "Draft Editor" } });
  const scope = { userId: user.id, workspaceId: workspace.id };
  const membership = await prisma.workspaceMembership.create({ data: { ...scope, role: "OWNER", status: "ACTIVE" } });
  const authenticatedScope = {
    ...scope,
    workspaceSlug: workspace.slug,
    membershipId: membership.id,
    role: membership.role,
  };
  const content = { text: "[Verse]\nFirst lyric", songTitle: "Way Maker", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false };
  try {
    const protections = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT relname::text, relrowsecurity FROM pg_class WHERE relname IN ('FormatterConversion', 'FormatterDraft') AND relnamespace = 'public'::regnamespace`;
    assert.equal(protections.length, 2);
    assert.ok(protections.every(table => table.relrowsecurity), "Both private formatter tables have RLS enabled");
    const privileges = await prisma.$queryRaw<Array<{ allowed: boolean }>>`SELECT has_table_privilege('anon', '"FormatterDraft"', 'SELECT') OR has_table_privilege('authenticated', '"FormatterDraft"', 'SELECT') AS allowed`;
    assert.equal(privileges[0].allowed, false, "Direct Data API roles cannot read drafts");
    assert.equal((await getFormatterDraft(authenticatedScope)).draft, null, "Authenticated workspace context is accepted");
    const first = await createFormatterDraft(authenticatedScope, { content, sourceName: "Way Maker.docx", parser: "docx" });
    const conversionId = first.draft!.conversionId;
    const firstSummary = first.history.find(row => row.id === conversionId);
    assert.deepEqual(firstSummary?.lastTouchedBy, { displayName: "Draft Editor" });
    assert.ok(firstSummary?.lastTouchedAt);
    const one = randomUUID(); const two = randomUUID();
    await changeFormatterDraft(scope, { action: "resume", conversionId, sessionId: one });
    await assert.rejects(changeFormatterDraft(scope, { action: "resume", conversionId, sessionId: two }), /another device/);
    await changeFormatterDraft(scope, { action: "takeover", conversionId, sessionId: two });
    await assert.rejects(changeFormatterDraft(scope, { action: "save", conversionId, sessionId: one, revision: 0, content }), /another device/);
    const saved = await changeFormatterDraft(scope, { action: "save", conversionId, sessionId: two, revision: 0, content: { ...content, text: "Changed" } });
    assert.equal(saved.draft!.revision, 1);
    await assert.rejects(changeFormatterDraft(scope, { action: "save", conversionId, sessionId: two, revision: 0, content }), /newer revision/);
    await recordFormatterFailure(authenticatedScope, "bad.pdf");
    assert.equal((await getFormatterDraft(scope)).draft!.conversionId, conversionId);
    for (let i = 0; i < 6; i++) await recordFormatterFailure(scope, `failed-${i}.pdf`);
    assert.ok((await getFormatterDraft(scope)).history.some(row => row.id === conversionId), "Failures never hide the resumable draft");
    const released = await changeFormatterDraft(scope, { action: "release", conversionId, sessionId: two });
    assert.equal(released.draft!.sessionId, null);
    assert.ok(Date.parse(released.draft!.expiresAt!) > Date.now() + 3_590_000);
    const resumed = await changeFormatterDraft(scope, { action: "resume", conversionId, sessionId: one });
    assert.equal(resumed.draft!.expiresAt, null);
    const otherScope = { ...scope, userId: randomUUID() };
    assert.equal((await getFormatterDraft(otherScope)).draft, null);
    await assert.rejects(changeFormatterDraft(otherScope, { action: "takeover", conversionId, sessionId: two }), /Done/);
    await prisma.formatterDraft.update({ where: { conversionId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await assert.rejects(changeFormatterDraft(scope, { action: "resume", conversionId, sessionId: one }), /Done/);
    await cleanupFormatterDrafts();
    assert.equal(await prisma.formatterDraft.count({ where: scope }), 0);
    assert.equal((await prisma.formatterConversion.findUniqueOrThrow({ where: { id: conversionId } })).status, "Done");
    await assert.rejects(createFormatterDraft(scope, { content, sourceName: "legacy", parser: "legacy" }, true), /history/);
    await Promise.all([1, 2].map(i => createFormatterDraft(scope, { content: { ...content, songTitle: `Concurrent ${i}` }, sourceName: "test.docx", parser: "docx" })));
    assert.equal(await prisma.formatterDraft.count({ where: scope }), 1);
    assert.equal(await prisma.formatterConversion.count({ where: { ...scope, status: "Draft" } }), 1);
    const current = (await getFormatterDraft(scope)).draft!;
    await changeFormatterDraft(scope, { action: "resume", conversionId: current.conversionId, sessionId: one });
    await changeFormatterDraft(scope, { action: "clear", conversionId: current.conversionId, sessionId: one });
    assert.equal((await getFormatterDraft(scope)).draft, null);
    const abandoned = (await createFormatterDraft(scope, { content, sourceName: "abandoned.docx", parser: "docx" })).draft!;
    await changeFormatterDraft(scope, { action: "resume", conversionId: abandoned.conversionId, sessionId: one });
    await prisma.formatterDraft.update({ where: { conversionId: abandoned.conversionId }, data: { lastSeenAt: new Date(Date.now() - 66 * 60000) } });
    await cleanupFormatterDrafts();
    assert.equal(await prisma.formatterDraft.count({ where: scope }), 0, "Lost browser sessions expire without page visits");
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
