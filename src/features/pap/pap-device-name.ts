export function getPAPDeviceName(role: "desktop" | "mobile") {
  if (typeof navigator === "undefined") {
    return role === "desktop" ? "Worship Flow Desktop" : "Mobile Device";
  }

  const platform = navigator.platform || navigator.userAgent;
  if (role === "desktop") {
    return `Worship Flow Desktop (${platform})`;
  }

  return /iphone|android|mobile/i.test(navigator.userAgent) ? "Mobile Phone" : `Mobile Device (${platform})`;
}
