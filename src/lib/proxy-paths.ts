const PUBLIC_PATH_PREFIXES = [
  "/",
  "/_next",
  "/favicon.ico",
  "/login",
  "/mockups",
  "/auth/callback",
  "/api/auth/login",
];

export function isPublicPathForProxy(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
}
