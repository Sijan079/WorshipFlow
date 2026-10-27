// Two facts about where the app is running, as pure functions so they can be tested.

// The address to put in the QR code and the shared link, or null when there is none worth sharing. In
// production only a valid https APP_URL counts: falling back to the address the admin is browsing
// could hand the congregation a link that opens a Vercel login. In development the page address wins.
export function shareableOrigin({ appUrl, requestOrigin, production }: { appUrl: string | undefined; requestOrigin: string; production: boolean }) {
  if (!production) return requestOrigin;
  const value = appUrl?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
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
