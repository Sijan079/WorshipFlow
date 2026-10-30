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

test("caption assembler updates the same line until speech ends", () => {
  const assembler = new CaptionAssembler();
  assert.deepEqual(assembler.accept({ is_final: true, speech_final: false, channel: { alternatives: [{ transcript: "Kumusta" }] } }),
    [{ line: 1, source: "Kumusta", final: false }]);
  assert.deepEqual(assembler.accept({ is_final: false, speech_final: false, channel: { alternatives: [{ transcript: "Kumusta ka" }] } }), []);
  assert.deepEqual(assembler.accept({ is_final: true, speech_final: false, channel: { alternatives: [{ transcript: "ka na?" }] } }),
    [{ line: 1, source: "Kumusta ka na?", final: false }]);
  assert.deepEqual(assembler.accept({ is_final: false, speech_final: true, channel: { alternatives: [{ transcript: "" }] } }),
    [{ line: 1, source: "Kumusta ka na?", final: true }]);
  assert.deepEqual(assembler.accept({ is_final: true, speech_final: true, channel: { alternatives: [{ transcript: "Welcome." }] } }),
    [{ line: 2, source: "Welcome.", final: true }]);
});

test("caption assembler splits continuous speech before an oversized line", () => {
  const assembler = new CaptionAssembler();
  const first = "a".repeat(160);
  assembler.accept({ is_final: true, speech_final: false, channel: { alternatives: [{ transcript: first }] } });
  const output = assembler.accept({ is_final: true, speech_final: false, channel: { alternatives: [{ transcript: "b".repeat(50) }] } });
  assert.deepEqual(output, [
    { line: 1, source: first, final: true },
    { line: 2, source: "b".repeat(50), final: false },
  ]);
});

test("caption assembler bounds an unusually long final transcript", () => {
  const assembler = new CaptionAssembler();
  const updates = assembler.accept({ is_final: true, speech_final: true, channel: { alternatives: [{ transcript: "a".repeat(410) }] } });
  assert.equal(updates.length, 3);
  assert.equal(updates.every((item) => item.source.length <= 200), true);
  assert.equal(updates.map((item) => item.source).join(""), "a".repeat(410));
  assert.equal(updates.every((item) => item.final), true);
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
