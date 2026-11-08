import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPTION_BROADCAST_EVENT, addPushedLine, applyPushedLine, overlayPushedLines, broadcastCaptionLine, captionTopic, parsePushedLine } from "./caption-realtime.ts";

const TOKEN = "a".repeat(32);

export async function runCaptionRealtimeTests() {
  // The channel is named after the link token, and only a real token is accepted.
  assert.equal(captionTopic(TOKEN), `captions:${TOKEN}`);
  assert.throws(() => captionTopic("187275bd-e16e-4bf7-9405-abd7f93173b5"));
  assert.throws(() => captionTopic(""));

  // Pushed messages are validated.
  assert.deepEqual(parsePushedLine({ line: 3, english: "Hello", final: true, extra: "x" }), { line: 3, english: "Hello", final: true });
  assert.equal(parsePushedLine(null), null);
  assert.equal(parsePushedLine({ line: "3", english: "Hello", final: true }), null);
  assert.equal(parsePushedLine({ line: 0, english: "Hello", final: true }), null);
  assert.equal(parsePushedLine({ line: 1, english: 5, final: true }), null);
  assert.equal(parsePushedLine({ line: 1, english: "Hi" }), null);

  // A pushed line is added, newest first; a newer version of the same line replaces it.
  const start = [{ line: 1, english: "One", final: true }];
  assert.deepEqual(applyPushedLine(start, { line: 2, english: "Two", final: false }).map((item) => item.line), [2, 1]);
  assert.equal(applyPushedLine([{ line: 2, english: "Tw", final: false }], { line: 2, english: "Two", final: true })[0].english, "Two");
  // A late interim never replaces a final.
  const finalLine = [{ line: 2, english: "Two.", final: true }];
  assert.equal(applyPushedLine(finalLine, { line: 2, english: "Tw", final: false }), finalLine);
  // Only the latest ten are kept.
  const many = Array.from({ length: 10 }, (_, index) => ({ line: index + 1, english: "x", final: true }));
  assert.equal(applyPushedLine(many, { line: 11, english: "y", final: false }).length, 10);

  // Pushed lines go over the (older) polled lines.
  const polled = [{ line: 5, english: "Five", final: true }, { line: 4, english: "Four", final: true }];
  assert.deepEqual(overlayPushedLines(polled, [{ line: 6, english: "Six", final: false }]).map((item) => item.line), [6, 5, 4]);
  assert.equal(overlayPushedLines(polled, [{ line: 5, english: "Five?", final: false }])[0].english, "Five");
  assert.equal(overlayPushedLines([{ line: 5, english: "Fiv", final: false }], [{ line: 5, english: "Five", final: true }])[0].english, "Five");
  assert.equal(overlayPushedLines(polled, []), polled);
  // Pushed lines far ahead of the poll belong to an earlier session, so the new session's poll wins.
  assert.equal(overlayPushedLines([{ line: 1, english: "New", final: false }], [{ line: 50, english: "Old", final: true }])[0].english, "New");
  // A restart seen in the pushes drops the old pushed lines.
  assert.deepEqual(addPushedLine([{ line: 50, english: "Old", final: true }], { line: 1, english: "New", final: false }).map((item) => item.line), [1]);
  assert.deepEqual(addPushedLine([{ line: 50, english: "Old", final: true }], { line: 51, english: "Next", final: false }).map((item) => item.line), [51, 50]);

  // The server sends with the secret key to the private channel, and never throws.
  let sent: { url: string; init: RequestInit } | null = null;
  const ok = await broadcastCaptionLine(TOKEN, { line: 4, english: "Hi", final: true }, { url: "https://p.supabase.co/", secretKey: "secret" }, (async (url: string, init: RequestInit) => { sent = { url, init }; return new Response(null, { status: 202 }); }) as unknown as typeof fetch);
  assert.equal(ok, true);
  assert.equal(sent!.url, "https://p.supabase.co/realtime/v1/api/broadcast");
  const body = JSON.parse(String(sent!.init.body));
  assert.deepEqual(body.messages[0], { topic: `captions:${TOKEN}`, event: CAPTION_BROADCAST_EVENT, payload: { line: 4, english: "Hi", final: true }, private: true });
  assert.equal((sent!.init.headers as Record<string, string>).apikey, "secret");
  assert.equal(await broadcastCaptionLine(TOKEN, { line: 1, english: "x", final: true }, {}), false);
  assert.equal(await broadcastCaptionLine(TOKEN, { line: 1, english: "x", final: true }, { url: "https://p.supabase.co", secretKey: "s" }, (async () => { throw new Error("down"); }) as unknown as typeof fetch), false);
  assert.equal(await broadcastCaptionLine(TOKEN, { line: 1, english: "x", final: true }, { url: "https://p.supabase.co", secretKey: "s" }, (async () => new Response(null, { status: 500 })) as unknown as typeof fetch), false);

  // The database policy lets listeners receive caption channels only, and gives nobody the right to send.
  const migrations = readFileSync(join(process.cwd(), "prisma", "migrations-current", "20261109120000_captions_realtime_policy", "migration.sql"), "utf8");
  assert.match(migrations, /realtime\.messages/);
  assert.match(migrations, /FOR SELECT/i);
  assert.match(migrations, /captions:%/);
  assert.doesNotMatch(migrations, /FOR (INSERT|ALL)/i);
}
