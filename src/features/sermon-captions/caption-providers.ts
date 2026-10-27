type Fetcher = typeof fetch;

export class CaptionProviderConfigurationError extends Error {}

// Azure refused because the allowance is used up, not because of a bad key or a busy moment.
export class CaptionProviderQuotaError extends Error {}

async function azureErrorDetail(response: Response) {
  try {
    const data: unknown = await response.json();
    const error = data && typeof data === "object" && "error" in data ? (data as { error?: { code?: unknown; message?: unknown } }).error : undefined;
    return { code: String(error?.code ?? ""), message: String(error?.message ?? "") };
  } catch {
    return { code: "", message: "" };
  }
}

export type DeepgramBalance = { amount: number; units: string };

export async function getDeepgramBalances(projectId: string, apiKey: string, fetcher: Fetcher = fetch): Promise<DeepgramBalance[]> {
  const response = await fetcher(`https://api.deepgram.com/v1/projects/${encodeURIComponent(projectId)}/balances`, {
    headers: { Authorization: `Token ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Deepgram balance request failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("balances" in data) || !Array.isArray(data.balances)) throw new Error("Invalid Deepgram balance response.");
  return data.balances.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("amount" in item) || !("units" in item)
      || typeof item.amount !== "number" || !Number.isFinite(item.amount) || typeof item.units !== "string" || !item.units.trim()) {
      throw new Error("Invalid Deepgram balance response.");
    }
    return { amount: item.amount, units: item.units };
  });
}

export async function requestDeepgramToken(apiKey: string, fetcher: Fetcher = fetch): Promise<string> {
  const response = await fetcher("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 403) throw new CaptionProviderConfigurationError("The Deepgram API key needs Member permission to issue a temporary browser token.");
  if (!response.ok) throw new Error(`Deepgram token grant failed (${response.status}).`);
  const data: unknown = await response.json();
  const token = data && typeof data === "object" && "access_token" in data ? data.access_token : null;
  if (typeof token !== "string" || !token) throw new Error("Deepgram did not return a temporary token.");
  return token;
}

const GLOBAL_TRANSLATOR = "https://api.cognitive.microsofttranslator.com";

// An optional geography endpoint (for example https://api-apc.cognitive.microsofttranslator.com) keeps requests
// in one part of the world. Only https hosts under microsofttranslator.com are accepted, because the key is sent there.
export function translatorBaseUrl(configured: string | undefined) {
  if (!configured?.trim()) return GLOBAL_TRANSLATOR;
  try {
    const url = new URL(configured.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && !url.username && !url.password && (host === "api.cognitive.microsofttranslator.com" || /^api-[a-z]+\.cognitive\.microsofttranslator\.com$/.test(host))) return `https://${host}`;
  } catch {
    // Not a URL: use the global endpoint.
  }
  return GLOBAL_TRANSLATOR;
}

export async function translateCaption(source: string, apiKey: string, region: string | undefined, fetcher: Fetcher = fetch, endpoint?: string): Promise<{ english: string; meteredCharacters: number | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    "Ocp-Apim-Subscription-Key": apiKey,
  };
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;
  const response = await fetcher(`${translatorBaseUrl(endpoint)}/translate?api-version=3.0&from=fil&to=en`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ Text: source }]),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // The free-quota error is a 403 (code 403001), so it is read before the key-failure branch below.
    const detail = await azureErrorDetail(response);
    if (detail.code === "403001" || /quota/i.test(`${detail.code} ${detail.message}`)) {
      throw new CaptionProviderQuotaError("The translation limit has been reached. Captions will return when it resets or the plan is upgraded.");
    }
    if (response.status === 401 || response.status === 403) throw new CaptionProviderConfigurationError("Azure Translator rejected the key and region configuration.");
    if (response.status === 429) throw new Error("Azure Translator is busy (429). Captions will continue when it recovers.");
    throw new Error(`Azure Translator failed (${response.status}).`);
  }
  const data: unknown = await response.json();
  const first = Array.isArray(data) ? data[0] : null;
  const english = first?.translations?.[0]?.text;
  if (typeof english !== "string" || !english.trim()) throw new Error("Azure Translator returned no English text.");
  const rawMetered = response.headers.get("x-metered-usage");
  const meteredCharacters = rawMetered && /^\d+$/.test(rawMetered) ? Number(rawMetered) : null;
  return { english: english.trim(), meteredCharacters: meteredCharacters !== null && Number.isSafeInteger(meteredCharacters) ? meteredCharacters : null };
}
