export const DESIGN_SYSTEM_VIEWER_EMAIL = "yuartsijan@gmail.com";

export function canViewDesignSystem(email: string | null | undefined) {
  return email?.trim().toLowerCase() === DESIGN_SYSTEM_VIEWER_EMAIL;
}
