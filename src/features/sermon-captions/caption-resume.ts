// After a reload the booth reconnects to the same session and link, but only the browser that started it
// can: it must hold the operator token, remember the input it was using, and be allowed to operate.
export function canResumeSession({ allowed, token, inputId }: { allowed: boolean; token: string; inputId: string }) {
  return allowed && token !== "" && inputId !== "";
}
