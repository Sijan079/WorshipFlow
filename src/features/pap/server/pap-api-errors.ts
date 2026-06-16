export const PAP_DATABASE_UNAVAILABLE_MESSAGE =
  "PAP media bridge storage is temporarily unavailable. Check the database connection and try again.";

type PrismaLikeError = {
  code?: string;
  meta?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

export function isPAPDatabaseUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as PrismaLikeError;
  const metaMessage = candidate.meta?.message ?? "";
  const message = candidate.message ?? "";

  return (
    candidate.code === "P1001" ||
    (candidate.code === "P2010" && /database not reachable/i.test(metaMessage)) ||
    /database not reachable/i.test(message)
  );
}

export function papDatabaseUnavailableResponse() {
  return Response.json(
    { error: PAP_DATABASE_UNAVAILABLE_MESSAGE },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
