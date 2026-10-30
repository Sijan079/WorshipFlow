import test from "node:test";
import assert from "node:assert/strict";
import { CaptionProviderQuotaError, translatorBaseUrl, getDeepgramBalances, parseDeepgramRequests, requestDeepgramToken, translateCaption } from "./caption-providers.ts";

test("Deepgram grant returns only a temporary token to the caller", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Response.json({ access_token: "temporary-token", expires_in: 30 });
  };
  assert.equal(await requestDeepgramToken("server-key", fetcher), "temporary-token");
  assert.equal(calls[0]?.url, "https://api.deepgram.com/v1/auth/grant");
  assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, "Token server-key");
});

test("Deepgram permission failure points to the required key role", async () => {
  await assert.rejects(
    () => requestDeepgramToken("restricted-key", async () => Response.json({ err_code: "FORBIDDEN" }, { status: 403 })),
    /Member permission/,
  );
});

test("Azure translates Filipino to English using server-only credentials", async () => {
  let request: { url: string; init?: RequestInit } | null = null;
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return Response.json([{ translations: [{ text: "How are you?" }] }], { headers: { "X-metered-usage": "15" } });
  };
  assert.deepEqual(await translateCaption("Kumusta ka na?", "azure-key", "eastus", fetcher), { english: "How are you?", meteredCharacters: 15 });
  assert.match(request!.url, /from=fil&to=en/);
  assert.equal((request!.init!.headers as Record<string, string>)["Ocp-Apim-Subscription-Region"], "eastus");
});

test("Azure uses the global endpoint unless a Microsoft translator endpoint is configured", async () => {
  assert.equal(translatorBaseUrl(undefined), "https://api.cognitive.microsofttranslator.com");
  assert.equal(translatorBaseUrl(""), "https://api.cognitive.microsofttranslator.com");
  assert.equal(translatorBaseUrl("https://api-apc.cognitive.microsofttranslator.com/"), "https://api-apc.cognitive.microsofttranslator.com");
  // Anything else is ignored, so a mistyped or hostile value can never send the key to another host.
  assert.equal(translatorBaseUrl("https://evil.example.com"), "https://api.cognitive.microsofttranslator.com");
  assert.equal(translatorBaseUrl("http://api-apc.cognitive.microsofttranslator.com"), "https://api.cognitive.microsofttranslator.com");
  assert.equal(translatorBaseUrl("https://api-apc.cognitive.microsofttranslator.com.evil.example"), "https://api.cognitive.microsofttranslator.com");
  let url = "";
  const fetcher = async (input: string | URL | Request) => {
    url = String(input);
    return Response.json([{ translations: [{ text: "Hi" }] }]);
  };
  await translateCaption("Kamusta", "key", "southeastasia", fetcher, "https://api-apc.cognitive.microsofttranslator.com");
  assert.ok(url.startsWith("https://api-apc.cognitive.microsofttranslator.com/translate?"), url);
});

test("Azure reports unknown usage when the metered header is missing or invalid", async () => {
  const response = (header?: string) => Response.json([{ translations: [{ text: "Hello" }] }], header ? { headers: { "X-metered-usage": header } } : undefined);
  assert.deepEqual(await translateCaption("Kamusta", "key", "", async () => response()), { english: "Hello", meteredCharacters: null });
  assert.deepEqual(await translateCaption("Kamusta", "key", "", async () => response("not-a-count")), { english: "Hello", meteredCharacters: null });
});

test("Deepgram balance reader preserves separate currencies and rejects malformed data", async () => {
  const fetcher = async () => Response.json({ balances: [{ balance_id: "one", amount: 12.5, units: "USD" }, { balance_id: "two", amount: 4, units: "CREDIT" }] });
  assert.deepEqual(await getDeepgramBalances("project-id", "billing-key", fetcher), [{ amount: 12.5, units: "USD" }, { amount: 4, units: "CREDIT" }]);
  await assert.rejects(() => getDeepgramBalances("project-id", "billing-key", async () => Response.json({ balances: [{ amount: "12", units: "USD" }] })), /invalid/i);
});

test("Azure rejects a successful response without translated text", async () => {
  await assert.rejects(() => translateCaption("Kumusta", "key", "", async () => Response.json([{}])));
});

test("Azure authentication failure identifies the key and region setup", async () => {
  await assert.rejects(
    () => translateCaption("Kumusta", "key", "eastus", async () => new Response(null, { status: 401 })),
    /key and region/,
  );
});

test("Azure over-quota is reported plainly, apart from key problems and plain throttling", async () => {
  const body = (code: number | string, message: string) => JSON.stringify({ error: { code, message } });
  const respond = (status: number, text: string) => async () => new Response(text, { status, headers: { "Content-Type": "application/json" } });
  // The free-quota error comes back as 403 with code 403001, so it must be checked before the key-failure branch.
  await assert.rejects(
    () => translateCaption("Kumusta", "key", "eastus", respond(403, body(403001, "The subscription has exceeded its free quota."))),
    (error: unknown) => error instanceof CaptionProviderQuotaError && /translation limit has been reached/i.test(error.message),
  );
  await assert.rejects(
    () => translateCaption("Kumusta", "key", "eastus", respond(429, body(429001, "AppIdOverQuota: the client has exceeded request limits."))),
    (error: unknown) => error instanceof CaptionProviderQuotaError,
  );
  // Plain throttling is a busy service, not an exhausted allowance.
  await assert.rejects(
    () => translateCaption("Kumusta", "key", "eastus", respond(429, body(429000, "Too many requests."))),
    (error: unknown) => !(error instanceof CaptionProviderQuotaError) && /busy/i.test((error as Error).message),
  );
  // A real key problem still says so.
  await assert.rejects(
    () => translateCaption("Kumusta", "key", "eastus", respond(403, body(403000, "Forbidden."))),
    /key and region/,
  );
  await assert.rejects(
    () => translateCaption("Kumusta", "key", "eastus", respond(401, body(401000, "Unauthorized."))),
    /key and region/,
  );
});

test("Deepgram requests become started, seconds and cost rows, and unfinished ones are left out", () => {
  const rows = parseDeepgramRequests({ requests: [
    { created: "2026-10-26T16:50:37.745723Z", response: { details: { duration: 20.94, usd: 0.00204 } } },
    { created: "2026-10-26T17:00:00Z" },
    { created: "not a date", response: { details: { duration: 5, usd: 1 } } },
  ] });
  assert.deepEqual(rows, [[Date.parse("2026-10-26T16:50:37.745723Z"), 20.94, 0.00204]]);
  assert.throws(() => parseDeepgramRequests({}), /Invalid/);
});
