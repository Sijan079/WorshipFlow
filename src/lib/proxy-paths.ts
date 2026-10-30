const PUBLIC_PATH_PREFIXES = [
  "/",
  "/_next",
  "/favicon.ico",
  "/login",
  "/mockups",
  "/auth/callback",
  "/api/auth/login",
  "/captions/live",
  "/c",
  "/api/captions/live",
];

export function isPublicPathForProxy(pathname: string) {
  // Machine-to-machine endpoint authenticates its scheduler secret in the handler.
  if (pathname === "/api/internal/formatter-cleanup" || pathname === "/api/internal/keep-alive") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isGlobalApiPathForProxy(pathname: string) {
  return pathname === "/api/health";
}
