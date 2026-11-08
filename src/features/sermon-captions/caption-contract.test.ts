import test from "node:test";
import assert from "node:assert/strict";
import { CaptionAssembler, canReadCaptionSession, captionViewerStatus, latestCaptionLines, normalizeCaptionSource, retainedCaptionExpiry } from "./caption-contract.ts";

test("viewer distinguishes connecting, live, interrupted, and terminal stream errors", () => {
  const now = new Date("2026-10-25T03:00:00Z");
  const session = { status: "LIVE", expiresAt: new Date("2026-10-25T04:00:00Z"), connectionStatus: "CONNECTING", lastHeartbeatAt: now };
  assert.equal(captionViewerStatus(session, now), "connecting");
  assert.equal(captionViewerStatus({ ...session, connectionStatus: "STREAMING" }, now), "live");
  assert.equal(captionViewerStatus({ ...session, connectionStatus: "STREAMING", lastHeartbeatAt: new Date("2026-10-25T02:59:44Z") }, now), "interrupted");
  assert.equal(captionViewerStatus({ ...session, connectionStatus: "INTERRUPTED" }, now), "interrupted");
  assert.equal(captionViewerStatus({ ...session, connectionStatus: "ERROR", lastHeartbeatAt: new Date("2026-10-25T02:00:00Z") }, now), "error");
  assert.equal(captionViewerStatus({ ...session, status: "ENDED" }, now), "ended");
});

test("stopped captions remain available for exactly one hour", () => {
  const stoppedAt = new Date("2026-10-25T02:00:00Z");
  assert.equal(retainedCaptionExpiry(stoppedAt).toISOString(), "2026-10-25T03:00:00.000Z");
});

test("operator captions keep the ten newest lines first and replace partial updates", () => {
  const existing = Array.from({ length: 11 }, (_, index) => ({ line: index + 1, english: `Line ${index + 1}`, final: true }));
  const lines = latestCaptionLines(existing, { line: 11, english: "Updated line 11", final: false });
  assert.equal(lines.length, 10);
  assert.deepEqual(lines.map((item) => item.line), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  assert.equal(lines[0].english, "Updated line 11");
});

const chunk = (transcript: string, flags: { is_final?: boolean; speech_final?: boolean } = { is_final: true }) => ({ ...flags, channel: { alternatives: [{ transcript }] } });

test("caption assembler keeps a line open until the sentence ends", () => {
  const assembler = new CaptionAssembler();
  assert.deepEqual(assembler.accept(chunk("Kumusta")), [{ line: 1, source: "Kumusta", final: false }]);
  assert.deepEqual(assembler.accept(chunk("Kumusta ka", { is_final: false })), []);
  // A sentence ending closes the line as soon as it arrives, without waiting for a pause.
  assert.deepEqual(assembler.accept(chunk("ka na?")), [{ line: 1, source: "Kumusta ka na?", final: true }]);
  assert.deepEqual(assembler.accept(chunk("", { is_final: false, speech_final: true })), []);
  assert.deepEqual(assembler.accept(chunk("Welcome.", { is_final: true, speech_final: true })), [{ line: 2, source: "Welcome.", final: true }]);
});

test("a pause without punctuation keeps the line open instead of cutting the sentence", () => {
  const assembler = new CaptionAssembler();
  assert.deepEqual(assembler.accept(chunk("Kumusta po", { is_final: true, speech_final: true })), [{ line: 1, source: "Kumusta po", final: false }]);
  // The same text is not sent again.
  assert.deepEqual(assembler.accept(chunk("", { is_final: false, speech_final: true })), []);
  assert.deepEqual(assembler.accept(chunk("sa inyo.")), [{ line: 1, source: "Kumusta po sa inyo.", final: true }]);
});

test("a long pause closes an open line, and so does a line that has run too long", () => {
  let now = 0;
  const assembler = new CaptionAssembler(0, () => now);
  assembler.accept(chunk("Kumusta po"));
  now = 1_000;
  assert.deepEqual(assembler.closeIfIdle(), []);
  now = 1_500;
  assert.deepEqual(assembler.closeIfIdle(), [{ line: 1, source: "Kumusta po", final: true }]);
  assert.deepEqual(assembler.closeIfIdle(), []);
  assert.deepEqual(assembler.accept(chunk("Next")), [{ line: 2, source: "Next", final: false }]);

  // Speech that never pauses or ends a sentence is still cut after a while.
  now = 10_000;
  assembler.accept(chunk("one"));
  now = 14_000;
  assembler.accept(chunk("two"));
  now = 17_000;
  assembler.accept(chunk("three"));
  now = 18_000;
  assert.deepEqual(assembler.closeIfIdle(), [{ line: 2, source: "Next one two three", final: true }]);
});

test("caption assembler splits continuous speech before an oversized line", () => {
  const assembler = new CaptionAssembler();
  const first = "a".repeat(160);
  assembler.accept(chunk(first));
  const output = assembler.accept(chunk("b".repeat(50)));
  assert.deepEqual(output, [
    { line: 1, source: first, final: true },
    { line: 2, source: "b".repeat(50), final: false },
  ]);
});

test("caption assembler bounds an unusually long final transcript", () => {
  const assembler = new CaptionAssembler();
  const updates = assembler.accept(chunk("a".repeat(410), { is_final: true, speech_final: true }));
  assert.equal(updates.length, 3);
  assert.equal(updates.every((item) => item.source.length <= 200), true);
  assert.equal(updates.map((item) => item.source).join(""), "a".repeat(410));
  // The last piece has no sentence ending yet, so it stays open.
  assert.deepEqual(updates.map((item) => item.final), [true, true, false]);
});

test("a forced cut prefers a comma or a conjunction over a random space", () => {
  const withComma = `${"alpha ".repeat(25).trim()}, ${"beta ".repeat(30).trim()}`;
  const [firstComma] = new CaptionAssembler().accept(chunk(withComma, { is_final: true, speech_final: true }));
  assert.equal(firstComma.source.endsWith("alpha,"), true);
  const withConjunction = `${"word ".repeat(32).trim()} pero ${"tama ".repeat(20).trim()}`;
  const [firstConjunction, second] = new CaptionAssembler().accept(chunk(withConjunction, { is_final: true, speech_final: true }));
  assert.equal(firstConjunction.source.endsWith("word"), true);
  assert.equal(second.source.startsWith("pero tama"), true);
});

test("caption source is bounded and viewer access expires", () => {
  assert.equal(normalizeCaptionSource("  Jeda  "), "Jeddah");
  assert.equal(normalizeCaptionSource("a".repeat(301)), null);
  assert.equal(canReadCaptionSession({ status: "LIVE", expiresAt: new Date("2026-10-25T03:00:00Z") }, new Date("2026-10-25T02:00:00Z")), true);
  assert.equal(canReadCaptionSession({ status: "LIVE", expiresAt: new Date("2026-10-25T03:00:00Z") }, new Date("2026-10-25T03:00:00Z")), false);
});

test("a paused session shows listeners paused, but a stale or broken one still shows its real problem", () => {
  const now = new Date("2026-10-25T03:00:00Z");
  const session = { status: "LIVE", expiresAt: new Date("2026-10-25T04:00:00Z"), connectionStatus: "STREAMING", lastHeartbeatAt: now, paused: true };
  assert.equal(captionViewerStatus(session, now), "paused");
  assert.equal(captionViewerStatus({ ...session, lastHeartbeatAt: new Date("2026-10-25T02:59:44Z") }, now), "interrupted");
  assert.equal(captionViewerStatus({ ...session, connectionStatus: "ERROR" }, now), "error");
  assert.equal(captionViewerStatus({ ...session, paused: false }, now), "live");
});
