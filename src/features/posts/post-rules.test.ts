import assert from "node:assert/strict";
import { test } from "node:test";
import { announcementGroups, announcementPhase, canDeleteAnnouncement, decideAnnouncementUpdate, isPubliclyVisible } from "./post-rules.ts";
import { CreateAnnouncementSchema, UpdateAnnouncementSchema } from "./post-validation.ts";

const zone = "Asia/Manila";
// 12:00 UTC on 2026-10-28 is 20:00 on 2026-10-28 in Manila.
const now = new Date("2026-10-28T12:00:00Z");

function post(over: Partial<{ status: "DRAFT" | "PUBLISHED"; isPublic: boolean; startDate: string | null; endDate: string | null; timezone: string; createdAt: string; title: string }> = {}) {
  return { status: "PUBLISHED" as const, isPublic: true, startDate: null, endDate: null, timezone: zone, createdAt: "2026-10-01T00:00:00Z", title: "Notice", ...over };
}

test("a draft is a draft, whatever its dates", () => {
  assert.equal(announcementPhase(post({ status: "DRAFT", startDate: "2026-10-01" }), now), "draft");
});

test("a published announcement is scheduled before its start, live in its dates, and ended after its end", () => {
  assert.equal(announcementPhase(post({ startDate: "2026-10-29" }), now), "scheduled");
  assert.equal(announcementPhase(post({ startDate: "2026-10-28" }), now), "live", "starts today");
  assert.equal(announcementPhase(post({ endDate: "2026-10-28" }), now), "live", "ends today, still live");
  assert.equal(announcementPhase(post({ endDate: "2026-10-27" }), now), "ended");
  assert.equal(announcementPhase(post({ startDate: "2026-10-20", endDate: "2026-11-02" }), now), "live");
});

test("no dates means live from publishing until it is unpublished", () => {
  assert.equal(announcementPhase(post(), now), "live");
});

test("dates are read in the announcement's own time zone", () => {
  // It is already 2026-10-29 in Manila at 17:00 UTC on the 28th.
  const late = new Date("2026-10-28T17:00:00Z");
  assert.equal(announcementPhase(post({ startDate: "2026-10-29" }), late), "live");
  assert.equal(announcementPhase(post({ startDate: "2026-10-29", timezone: "UTC" }), late), "scheduled");
});

test("only a published, switched-on announcement that is live is public", () => {
  assert.equal(isPubliclyVisible(post(), now), true);
  assert.equal(isPubliclyVisible(post({ isPublic: false }), now), false);
  assert.equal(isPubliclyVisible(post({ status: "DRAFT" }), now), false);
  assert.equal(isPubliclyVisible(post({ startDate: "2026-10-29" }), now), false, "scheduled");
  assert.equal(isPubliclyVisible(post({ endDate: "2026-10-27" }), now), false, "ended");
});

test("only a draft can be deleted", () => {
  assert.equal(canDeleteAnnouncement({ status: "DRAFT" }), true);
  assert.equal(canDeleteAnnouncement({ status: "PUBLISHED" }), false);
});

test("lists are grouped, soonest start first, then newest created; ended shows the most recent 20", () => {
  const items = [
    { id: "a", ...post({ status: "DRAFT" }) },
    { id: "b", ...post({ startDate: "2026-10-20", createdAt: "2026-10-02T00:00:00Z" }) },
    { id: "c", ...post({ startDate: "2026-10-10", createdAt: "2026-10-03T00:00:00Z" }) },
    { id: "d", ...post({ startDate: "2026-11-05" }) },
    { id: "e", ...post({ endDate: "2026-10-20" }) },
    { id: "f", ...post({ endDate: "2026-10-25" }) },
    { id: "g", ...post({ createdAt: "2026-10-09T00:00:00Z" }) },
  ];
  const groups = announcementGroups(items, now);
  assert.deepEqual(groups.drafts.map((entry) => entry.id), ["a"]);
  assert.deepEqual(groups.live.map((entry) => entry.id), ["c", "b", "g"], "dated first by start, undated last by newest created");
  assert.deepEqual(groups.scheduled.map((entry) => entry.id), ["d"]);
  assert.deepEqual(groups.ended.map((entry) => entry.id), ["f", "e"], "latest end first");
  const many = Array.from({ length: 25 }, (_, index) => ({ id: String(index), ...post({ endDate: `2026-09-${String(index + 1).padStart(2, "0")}` }) }));
  assert.equal(announcementGroups(many, now).ended.length, 20);
  assert.equal(announcementGroups(many, now).endedTotal, 25);
});

test("without the Publish permission a person cannot publish, unpublish, or change the website switch", () => {
  const existing = { status: "DRAFT" as const, isPublic: false };
  assert.equal(decideAnnouncementUpdate({ existing, input: { status: "PUBLISHED" }, canPublish: false }).ok, false);
  assert.equal(decideAnnouncementUpdate({ existing, input: { isPublic: true }, canPublish: false }).ok, false);
  assert.equal(decideAnnouncementUpdate({ existing: { status: "PUBLISHED", isPublic: true }, input: { status: "DRAFT" }, canPublish: false }).ok, false);
  assert.equal(decideAnnouncementUpdate({ existing, input: { status: "DRAFT", isPublic: false, title: "New" }, canPublish: false }).ok, true, "sending the same values is not a change");
  assert.equal(decideAnnouncementUpdate({ existing, input: { status: "PUBLISHED" }, canPublish: true }).ok, true);
});

test("editing the content of a published announcement without Publish sends it back to Draft", () => {
  const existing = { status: "PUBLISHED" as const, isPublic: true };
  const edited = decideAnnouncementUpdate({ existing, input: { body: "Changed" }, canPublish: false });
  assert.equal(edited.ok, true);
  assert.equal(edited.ok && edited.status, "DRAFT");
  assert.equal(edited.ok && edited.sentBackToDraft, true);
  const publisher = decideAnnouncementUpdate({ existing, input: { body: "Changed" }, canPublish: true });
  assert.equal(publisher.ok && publisher.status, undefined, "a publisher edits live");
  assert.equal(publisher.ok && publisher.sentBackToDraft, false);
  const draftEdit = decideAnnouncementUpdate({ existing: { status: "DRAFT", isPublic: false }, input: { body: "Changed" }, canPublish: false });
  assert.equal(draftEdit.ok && draftEdit.sentBackToDraft, false, "a draft stays a draft");
});

test("an announcement is validated as an announcement: no article fields, and the end is not before the start", () => {
  const good = { title: "Youth camp", body: "Sign up by Friday.", timezone: zone };
  assert.equal(CreateAnnouncementSchema.safeParse(good).success, true);
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, slug: "youth-camp" }).success, false, "no slug");
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, publishDate: "2026-10-28" }).success, false, "no article publish date");
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, kind: "ARTICLE" }).success, false, "the kind is not chosen by the caller");
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, startDate: "2026-11-02", endDate: "2026-11-01" }).success, false);
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, startDate: "2026-11-02", endDate: "2026-11-02" }).success, true);
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, title: "  " }).success, false);
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, body: "x".repeat(4001) }).success, false);
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, createdById: "someone-else" }).success, false, "authorship comes from the session");
  assert.equal(CreateAnnouncementSchema.safeParse({ ...good, eventId: "not-a-uuid" }).success, false);
  assert.equal(UpdateAnnouncementSchema.safeParse({}).success, false, "change at least one thing");
  assert.equal(UpdateAnnouncementSchema.safeParse({ slug: "x" }).success, false);
  assert.equal(UpdateAnnouncementSchema.safeParse({ eventId: null }).success, true, "the link can be cleared");
});
