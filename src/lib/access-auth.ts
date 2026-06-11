import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const ACCESS_SESSION_COOKIE = "worshipflow_session";
export const ACCESS_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

type AccessSessionPayload = {
  exp: number;
  iat: number;
  nonce: string;
  user: string;
};

function getSessionSecret() {
  return process.env.APP_ACCESS_SESSION_SECRET || process.env.APP_ACCESS_PASSWORD || "";
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("APP_ACCESS_SESSION_SECRET or APP_ACCESS_PASSWORD is required.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAccessSessionCookie(user: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessSessionPayload = {
    exp: now + ACCESS_SESSION_MAX_AGE_SECONDS,
    iat: now,
    nonce: randomBytes(16).toString("base64url"),
    user,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAccessSessionCookie(cookieValue: string | undefined) {
  if (!cookieValue) return false;

  const [encodedPayload, signature, extra] = cookieValue.split(".");
  if (!encodedPayload || !signature || extra) return false;

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AccessSessionPayload>;
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function hasValidAccessCredentials(user: string, password: string) {
  const expectedPassword = process.env.APP_ACCESS_PASSWORD;
  const expectedUser = process.env.APP_ACCESS_USER;

  if (!expectedPassword) return false;
  const passwordMatches = safeEqual(password, expectedPassword);
  const userMatches = expectedUser ? safeEqual(user, expectedUser) : true;

  return passwordMatches && userMatches;
}
