export function getAuthRedirectUrl(origin: string, nextPath: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function getAuthCallbackRecoveryUrl(requestUrl: string) {
  const url = new URL(requestUrl);

  if (url.pathname !== "/" || !url.searchParams.get("code")) return null;

  url.pathname = "/auth/callback";
  return url.toString();
}
