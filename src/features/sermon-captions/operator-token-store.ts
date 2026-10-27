// The operator token proves this browser started the session. It lives in sessionStorage so a page
// refresh can still stop the session, and it is gone when the tab closes.

const keyFor = (sessionId: string) => `caption-operator-${sessionId}`;

export function loadOperatorToken(sessionId: string) {
  try { return sessionStorage.getItem(keyFor(sessionId)) || ""; } catch { return ""; }
}

export function saveOperatorToken(sessionId: string, token: string) {
  try { sessionStorage.setItem(keyFor(sessionId), token); } catch { /* The session still ends at its expiry. */ }
}

export function clearOperatorToken(sessionId: string) {
  try { sessionStorage.removeItem(keyFor(sessionId)); } catch { /* Nothing to clear. */ }
  try { sessionStorage.removeItem(inputKeyFor(sessionId)); } catch { /* Nothing to clear. */ }
}

// The input this tab was using, so a reload can reconnect to the same one.
const inputKeyFor = (sessionId: string) => `caption-input-${sessionId}`;

export function saveOperatorInput(sessionId: string, input: { id: string; label: string }) {
  try { sessionStorage.setItem(inputKeyFor(sessionId), JSON.stringify(input)); } catch { /* Resume is then skipped. */ }
}

export function loadOperatorInput(sessionId: string): { id: string; label: string } {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(inputKeyFor(sessionId)) ?? "");
    if (parsed && typeof parsed === "object" && "id" in parsed && "label" in parsed && typeof parsed.id === "string" && typeof parsed.label === "string") {
      return { id: parsed.id, label: parsed.label };
    }
  } catch { /* Nothing remembered. */ }
  return { id: "", label: "" };
}
