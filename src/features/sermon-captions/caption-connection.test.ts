import test from "node:test";
import assert from "node:assert/strict";
import { CaptionStreamConnection } from "./caption-connection.ts";

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: unknown[] = [];

  open() { this.readyState = 1; this.onopen?.(); }
  drop(code = 1006) { this.readyState = 3; this.onclose?.({ code }); }
  send(data: unknown) { this.sent.push(data); }
  close() { this.drop(); }
}

class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  starts = 0;
  stops = 0;
  start() { this.state = "recording"; this.starts++; }
  stop() { this.state = "inactive"; this.stops++; }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const socketTokens: string[] = [];
  const recorders: FakeRecorder[] = [];
  const tokens: string[] = [];
  const states: string[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  let disconnects = 0;
  const connection = new CaptionStreamConnection({
    initialToken: "first-token",
    getToken: async () => { const token = `fresh-${tokens.length + 1}`; tokens.push(token); return token; },
    createSocket: (token) => { const socket = new FakeSocket(); sockets.push(socket); socketTokens.push(token); return socket as unknown as WebSocket; },
    createRecorder: () => { const recorder = new FakeRecorder(); recorders.push(recorder); return recorder as unknown as MediaRecorder; },
    onMessage: () => {},
    onState: (state) => states.push(state),
    onDisconnect: () => { disconnects++; },
    setTimer: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimer: (id) => { timers.delete(id); },
    wait: async () => {},
  });
  return { connection, sockets, socketTokens, recorders, tokens, states, timers, get disconnects() { return disconnects; }, runNext() { const [id, callback] = timers.entries().next().value as [number, () => void]; timers.delete(id); callback(); } };
}

test("a dropped socket reconnects with a fresh token and recorder without ending the session", async () => {
  const h = harness();
  h.connection.start();
  assert.equal(h.sockets.length, 1);
  h.sockets[0].open();
  assert.equal(h.recorders[0].starts, 1);
  h.sockets[0].drop();
  assert.equal(h.recorders[0].stops, 1);
  assert.equal(h.disconnects, 1);
  assert.equal(h.states.at(-1), "reconnecting");
  h.runNext();
  await Promise.resolve();
  assert.deepEqual(h.tokens, ["fresh-1"]);
  assert.deepEqual(h.socketTokens, ["first-token", "fresh-1"]);
  assert.equal(h.sockets.length, 2);
  h.sockets[1].open();
  assert.equal(h.recorders[1].starts, 1);
  assert.equal(h.states.at(-1), "live");
});

test("stopping during a network drop cancels the reconnect attempt", () => {
  const h = harness();
  h.connection.start();
  h.sockets[0].open();
  h.sockets[0].drop();
  assert.equal(h.timers.size, 1);
  h.connection.stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.sockets.length, 1);
});

test("an offline signal replaces a socket that still appears open", async () => {
  const h = harness();
  h.connection.start();
  h.sockets[0].open();
  h.connection.interrupt();
  assert.equal(h.recorders[0].stops, 1);
  assert.equal(h.timers.size, 1);
  h.connection.retryNow();
  await Promise.resolve();
  assert.equal(h.sockets.length, 2);
  assert.deepEqual(h.tokens, ["fresh-1"]);
});

test("finishing during connection setup closes the socket and cancels retries", async () => {
  const h = harness();
  h.connection.start();
  await h.connection.finish();
  assert.equal(h.sockets[0].readyState, 3);
  assert.equal(h.timers.size, 0);
});

test("manual finish sends CloseStream and does not reconnect", async () => {
  const h = harness();
  h.connection.start();
  h.sockets[0].open();
  await h.connection.finish();
  assert.equal(h.recorders[0].stops, 1);
  assert.deepEqual(h.sockets[0].sent, [JSON.stringify({ type: "CloseStream" })]);
  assert.equal(h.sockets[0].readyState, 3);
  assert.equal(h.timers.size, 0);
});

test("a fatal Deepgram close shows error and stops retries", () => {
  const h = harness();
  h.connection.start();
  h.sockets[0].open();
  h.sockets[0].drop(1008);
  assert.equal(h.states.at(-1), "error");
  assert.equal(h.timers.size, 0);
});
