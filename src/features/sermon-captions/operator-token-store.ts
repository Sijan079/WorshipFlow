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
}
