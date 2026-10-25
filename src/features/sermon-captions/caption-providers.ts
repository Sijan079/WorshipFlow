type Fetcher = typeof fetch;

export class CaptionProviderConfigurationError extends Error {}

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

export async function translateCaption(source: string, apiKey: string, region: string | undefined, fetcher: Fetcher = fetch): Promise<{ english: string; meteredCharacters: number | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    "Ocp-Apim-Subscription-Key": apiKey,
  };
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;
  const response = await fetcher("https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=fil&to=en", {
    method: "POST",
    headers,
    body: JSON.stringify([{ Text: source }]),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401 || response.status === 403) throw new CaptionProviderConfigurationError("Azure Translator rejected the key and region configuration.");
  if (!response.ok) throw new Error(`Azure Translator failed (${response.status}).`);
  const data: unknown = await response.json();
  const first = Array.isArray(data) ? data[0] : null;
  const english = first?.translations?.[0]?.text;
  if (typeof english !== "string" || !english.trim()) throw new Error("Azure Translator returned no English text.");
  const rawMetered = response.headers.get("x-metered-usage");
  const meteredCharacters = rawMetered && /^\d+$/.test(rawMetered) ? Number(rawMetered) : null;
  return { english: english.trim(), meteredCharacters: meteredCharacters !== null && Number.isSafeInteger(meteredCharacters) ? meteredCharacters : null };
}
