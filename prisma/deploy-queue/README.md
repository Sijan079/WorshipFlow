# Deploy queue

Migrations here are written and tested but **not applied**. Each is destructive
and must wait until the code that no longer needs the data is deployed, because the
deployed app and local development share one hosted database.

To apply one: move its folder into `prisma/migrations-current/` (keeping the
timestamp order), run `npm run test:migrations`, then `prisma migrate deploy`.
