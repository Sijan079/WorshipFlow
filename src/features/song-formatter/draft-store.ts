import type { Prisma, FormatterDraft } from "@prisma/client";
import prisma from "../../lib/prisma.ts";
import { CONNECTION_GRACE_MS, DRAFT_TTL_MS, draftExpired, mayWriteDraft } from "./draft-lifecycle.ts";
import { DraftContentSchema, type DraftCommand, type DraftContent, type DraftResponse } from "./draft-contract.ts";

type Scope = { workspaceId: string; userId: string };
const databaseScope = (scope: Scope): Scope => ({ workspaceId: scope.workspaceId, userId: scope.userId });
export class DraftError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
const lease = (draft: FormatterDraft) => ({ ...draft, expiresAt: draft.expiresAt?.getTime() ?? null, lastSeenAt: draft.lastSeenAt.getTime() });

// Lock one membership row: serializes extraction completion, takeover, save and cleanup
// even when no draft exists yet. No in-process locks or browser clocks are trusted.
async function scoped<T>(inputScope: Scope, fn: (tx: Prisma.TransactionClient, now: Date, scope: Scope) => Promise<T>) {
  const scope = databaseScope(inputScope);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WorkspaceMembership" WHERE "workspaceId" = ${scope.workspaceId} AND "userId" = ${scope.userId} FOR UPDATE`;
    return fn(tx, new Date(), scope);
  });
}
async function finish(tx: Prisma.TransactionClient, draft: FormatterDraft, now: Date) {
  await tx.formatterDraft.delete({ where: { conversionId: draft.conversionId } });
  await tx.formatterConversion.update({ where: { id: draft.conversionId }, data: { status: "Done", finishedAt: now } });
}
async function snapshot(tx: Prisma.TransactionClient, scope: Scope, now: Date): Promise<DraftResponse> {
  const draft = await tx.formatterDraft.findUnique({ where: { workspaceId_userId: scope } });
  const rows = await tx.formatterConversion.findMany({
    where: scope,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    include: { user: { select: { displayName: true } } },
  });
  // Failed attempts must not push the only resumable draft out of the visible list.
  if (draft && !rows.some(row => row.id === draft.conversionId)) {
    const resumable = await tx.formatterConversion.findUniqueOrThrow({
      where: { id: draft.conversionId },
      include: { user: { select: { displayName: true } } },
    });
    rows.splice(4, 1, resumable);
  }
  return {
    serverNow: now.toISOString(),
    history: rows.map(row => {
      const current = draft?.conversionId === row.id ? draft : null;
      const open = Boolean(current?.sessionId && current.lastSeenAt.getTime() + CONNECTION_GRACE_MS > now.getTime());
      return { id: row.id, songTitle: row.songTitle, sourceName: row.sourceName, parser: row.parser,
        createdAt: row.createdAt.toISOString(), status: row.status as "Draft" | "Done" | "Failed", open,
        lastTouchedAt: (current?.lastSeenAt ?? row.finishedAt ?? row.createdAt).toISOString(),
        lastTouchedBy: row.user,
        expiresAt: current && !open ? new Date(current.expiresAt?.getTime() ?? current.lastSeenAt.getTime() + CONNECTION_GRACE_MS + DRAFT_TTL_MS).toISOString() : null };
    }),
    draft: draft ? { conversionId: draft.conversionId, content: DraftContentSchema.parse(draft.content), revision: draft.revision,
      sessionId: draft.sessionId, expiresAt: draft.expiresAt?.toISOString() ?? null, lastSeenAt: draft.lastSeenAt.toISOString() } : null,
  };
}
export async function getFormatterDraft(scope: Scope) {
  return scoped(scope, async (tx, now, scope) => {
    const draft = await tx.formatterDraft.findUnique({ where: { workspaceId_userId: scope } });
    if (draft && draftExpired(lease(draft), now.getTime())) await finish(tx, draft, now);
    return snapshot(tx, scope, now);
  });
}
export async function createFormatterDraft(scope: Scope, input: { content: DraftContent; sourceName: string; parser: string; jobId?: string }, legacy = false) {
  const content = DraftContentSchema.parse(input.content);
  return scoped(scope, async (tx, now, scope) => {
    if (legacy && await tx.formatterConversion.count({ where: scope })) throw new DraftError("An existing conversion history prevents importing this old draft.");
    const previous = await tx.formatterDraft.findUnique({ where: { workspaceId_userId: scope } });
    if (previous) await finish(tx, previous, now);
    const conversion = await tx.formatterConversion.create({ data: {
      ...scope, songTitle: content.songTitle, sourceName: input.sourceName.slice(0, 500), parser: input.parser, jobId: input.jobId,
    } });
    await tx.formatterDraft.create({ data: { ...scope, conversionId: conversion.id, content, lastSeenAt: now, expiresAt: new Date(now.getTime() + DRAFT_TTL_MS) } });
    return snapshot(tx, scope, now);
  });
}
export async function recordFormatterFailure(inputScope: Scope, sourceName: string) {
  // Failure is metadata only and never supersedes the current draft.
  const scope = databaseScope(inputScope);
  return prisma.formatterConversion.create({ data: { ...scope, sourceName: sourceName.slice(0, 500), songTitle: "", parser: "", status: "Failed", finishedAt: new Date() } });
}
export async function changeFormatterDraft(scope: Scope, command: DraftCommand) {
  if (command.action === "legacy" && "content" in command) {
    return createFormatterDraft(scope, { content: command.content, sourceName: "Recovered local draft", parser: "legacy" }, true);
  }
  if (!("conversionId" in command)) throw new DraftError("Invalid draft action.", 400);
  return scoped(scope, async (tx, now, scope) => {
    const draft = await tx.formatterDraft.findUnique({ where: { workspaceId_userId: scope } });
    if (!draft || draft.conversionId !== command.conversionId || draftExpired(lease(draft), now.getTime())) {
      throw new DraftError("This conversion is Done and can no longer be edited.", 410);
    }
    const owned = draft.sessionId === command.sessionId;
    if (command.action === "resume" || command.action === "takeover") {
      const activeElsewhere = draft.sessionId && !owned && draft.lastSeenAt.getTime() + CONNECTION_GRACE_MS > now.getTime();
      if (activeElsewhere && command.action !== "takeover") throw new DraftError("This draft is open on another device. Choose Take over editing to continue.");
      await tx.formatterDraft.update({ where: { conversionId: draft.conversionId }, data: { sessionId: command.sessionId, lastSeenAt: now, expiresAt: null } });
    } else {
      if (!owned) throw new DraftError("Editing moved to another device. This copy is read-only.");
      if (command.action === "save" && "content" in command && "revision" in command) {
        if (!mayWriteDraft(lease(draft), command.sessionId, command.revision, now.getTime())) throw new DraftError("A newer revision exists. Reload the draft before editing.");
        await tx.formatterDraft.update({ where: { conversionId: draft.conversionId }, data: { content: command.content, revision: { increment: 1 }, lastSeenAt: now, expiresAt: null } });
        await tx.formatterConversion.update({ where: { id: draft.conversionId }, data: { songTitle: command.content.songTitle } });
      } else if (command.action === "heartbeat") {
        await tx.formatterDraft.update({ where: { conversionId: draft.conversionId }, data: { lastSeenAt: now, expiresAt: null } });
      } else if (command.action === "release") {
        await tx.formatterDraft.update({ where: { conversionId: draft.conversionId }, data: { sessionId: null, lastSeenAt: now, expiresAt: new Date(now.getTime() + DRAFT_TTL_MS) } });
      } else if (command.action === "clear") await finish(tx, draft, now);
      else throw new DraftError("Invalid draft action.", 400);
    }
    return snapshot(tx, scope, now);
  });
}
export async function cleanupFormatterDrafts() {
  const now = new Date();
  const expired = await prisma.formatterDraft.findMany({ where: { OR: [
    { expiresAt: { lte: now } }, { expiresAt: null, lastSeenAt: { lte: new Date(now.getTime() - CONNECTION_GRACE_MS - DRAFT_TTL_MS) } },
  ] }, select: { workspaceId: true, userId: true }, take: 500 });
  let removed = 0;
  for (const scope of expired) await scoped(scope, async (tx, time, scope) => {
    const draft = await tx.formatterDraft.findUnique({ where: { workspaceId_userId: scope } });
    if (draft && draftExpired(lease(draft), time.getTime())) { await finish(tx, draft, time); removed++; }
  });
  return removed;
}
