// Two facts about where the app is running, as pure functions so they can be tested.

// The address the QR code and listener link use. In production it is APP_URL (the public https
// address), because the team alias and per-deployment addresses sit behind a Vercel login and would
// not open for the congregation. In development the address you are actually on wins, because
// APP_URL names port 3000 while the dev server may run on another port.
export function canonicalOrigin({ appUrl, requestOrigin, production }: { appUrl: string | undefined; requestOrigin: string; production: boolean }) {
  if (!production) return requestOrigin;
  const value = appUrl?.trim();
  if (!value) return requestOrigin;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : requestOrigin;
  } catch {
    return requestOrigin;
  }
}

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

// True when a development server is connected to a database that is not on this computer. Dev and
// production share one hosted database, so captions started from here would appear on the real
// congregation link.
export function isLiveDatabaseInDev(databaseUrl: string | undefined, nodeEnv: string | undefined) {
  if (nodeEnv === "production" || !databaseUrl) return false;
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host !== "" && !LOCAL_DATABASE_HOSTS.has(host);
  } catch {
    return false;
  }
}
