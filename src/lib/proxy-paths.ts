const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/login",
  "/api/auth/login",
];

export function isPublicPathForProxy(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
