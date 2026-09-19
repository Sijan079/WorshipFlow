export function draftSaveState(status: string): "saved" | "pending" | "unavailable" {
  if (status === "Saved on this device" || status === "Saved across your devices") return "saved";
  if (/not saved|unavailable|could not|offline|failed|read-only|another device|permission|authentication/i.test(status)) return "unavailable";
  return "pending";
}
