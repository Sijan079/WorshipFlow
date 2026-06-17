# Local Development

## App

```powershell
npm run dev
```

Copy `.env.example` to `.env` and fill in local values when database, AI, or
phone-transfer settings are needed. `APP_ACCESS_PASSWORD` can stay unset during
local development.

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
