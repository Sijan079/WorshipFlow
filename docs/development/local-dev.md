# Local Development

## App

```powershell
npm run dev
```

`npm run dev` runs Next.js locally against the hosted Supabase project configured
in ignored `.env.local`. Its database, Auth, and Storage settings must refer to
the same project. App data changes appear in that project's dashboard. Schema
migrations are a separate explicit operation. Use `npm run dev:docker` to start
the isolated local Docker Supabase stack instead.

For Google or email sign-in against hosted Supabase, add
`http://localhost:3000/**` to the hosted project's **Authentication → URL
Configuration → Redirect URLs**. Keep its Site URL pointed at the deployed app.
The local `supabase/config.toml` redirect setting does not change the hosted
project.

Copy `.env.example` to `.env` for optional AI or phone-transfer settings. Keep
hosted database credentials and Supabase keys in ignored `.env.local`.

For phone transfer testing from another device on the same network:

```powershell
npm run dev -- -H 0.0.0.0
```

If Phone Transfer returns a storage-unavailable response, verify that the
connected database has the PAP inbox migration applied. In Supabase SQL Editor:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'PAPInboxScreenshot';
```

The query should return one row named `PAPInboxScreenshot`.

## Workspace Hygiene

Codex desktop startup and new-thread creation can slow down when the workspace
accumulates large generated folders. For this project, the main culprits are
usually:

- `.next/`
- `.codex-backups/`
- `.worship-flow-private/` when it contains leftover generated assets

Best-practice local cleanup:

```powershell
Remove-Item -LiteralPath .next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .codex-backups -Recurse -Force -ErrorAction SilentlyContinue
```

Notes:

- `node_modules/` should usually stay in place unless you are fixing dependency
  issues.
- `.next/` is safe to delete whenever the dev server is stopped; Next.js will
  rebuild it.
- `.codex-backups/` is local-only scratch output and should not be allowed to
  grow indefinitely.
- Generated backgrounds and PAP temporary assets should stay temporary in local
  development too; clean `.worship-flow-private/` if you are done testing them.
