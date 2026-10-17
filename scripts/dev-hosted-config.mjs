function required(value, name) {
  if (!value) throw new Error(`${name} is required for hosted development.`);
  return value;
}

export function validateHostedDevEnvironment(env) {
  const authUrl = new URL(required(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"));
  const projectRef = authUrl.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
  if (authUrl.protocol !== "https:" || !projectRef) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must point to a hosted Supabase project.");
  }

  required(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  required(env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY");

  if (env.SUPABASE_URL && new URL(env.SUPABASE_URL).origin !== authUrl.origin) {
    throw new Error("SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must use the same Supabase project.");
  }

  const databaseUrl = new URL(required(env.DATABASE_URL, "DATABASE_URL"));
  const isProjectDatabase = databaseUrl.hostname === `db.${projectRef}.supabase.co`;
  const isProjectPooler = databaseUrl.hostname.endsWith(".pooler.supabase.com")
    && decodeURIComponent(databaseUrl.username).endsWith(`.${projectRef}`);
  if (!databaseUrl.protocol.startsWith("postgres") || (!isProjectDatabase && !isProjectPooler)) {
    throw new Error("DATABASE_URL must point to the same hosted Supabase database as Auth.");
  }

  return projectRef;
}
