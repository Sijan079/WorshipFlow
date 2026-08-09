export function getAuthRedirectUrl(origin: string, nextPath: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}
