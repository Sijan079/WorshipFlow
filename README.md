# Worship Flow OS

Worship Flow OS is a worship service preparation platform for church tech teams. It focuses on one job: building structured worship services with participants, songs, assets, automation jobs, and generated outputs.

This project is not a general church management system. It does not cover chat, notifications, recurring events, fellowships, prayer meetings, or broad event management.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form + Zod
- Prisma ORM
- PostgreSQL

## Current Phase 1 Features

- Worship service CRUD
- Strict worship block ordering
- Participant assignment per block
- Song repository
- Add songs to worship services
- Service asset persistence and upload
- Automation job persistence
- Generated output persistence

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create or update `.env` with a PostgreSQL connection string:

```env
DATABASE_URL="postgresql://USER@localhost:5432/worship_flow"
NEXT_PUBLIC_API_URL="http://localhost:3000"
# Optional: enables the manual AI cleanup retry in the secure lyrics extractor.
OPENAI_API_KEY=""
OPENAI_EXTRACTOR_MODEL="gpt-4.1-mini"
```

`NEXT_PUBLIC_API_URL` is optional for local browser use, but it helps server-side fetches stay explicit.
`OPENAI_API_KEY` is optional. The lyrics extractor remains local-first without it; the manual AI cleanup button will report that AI cleanup is not configured.

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Run migrations

For a new local database:

```bash
npx prisma migrate dev --name init
```

If your schema is already applied and you only need to sync local metadata:

```bash
npx prisma db push
```

### 5. Seed the database

```bash
npx prisma db seed
```

The seed includes a sample `Ladies Ministry` worship service dated May 24 and preloads the worship flow blocks in strict order.

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow Notes

- The service builder always renders blocks in this order:
  1. `CALL_TO_WORSHIP`
  2. `PRAISE_AND_WORSHIP`
  3. `MC`
  4. `AWIT_NG_PAKIKINIG`
  5. `SCRIPTURE_READING`
  6. `SERMON`
  7. `AWIT_NG_PAGTUGON`
  8. `OFFERING`
  9. `FLOWERS_FOR_THE_LORD`
  10. `DETAILS`
- `AWIT_NG_PAKIKINIG` stays before `SCRIPTURE_READING`.
- `AWIT_NG_PAGTUGON` stays after `SERMON`.
- New services create all 10 blocks immediately.

## API Surface

Route handlers live under `src/app/api`.

- `GET /api/services`
- `POST /api/services`
- `GET /api/services/:id`
- `PUT /api/services/:id`
- `DELETE /api/services/:id`
- `POST /api/services/:id/blocks/:blockId/people`
- `PUT /api/services/:id/blocks/:blockId/people/:personId`
- `DELETE /api/services/:id/blocks/:blockId/people/:personId`
- `POST /api/services/:id/songs`
- `DELETE /api/services/:id/songs/:serviceSongId`
- `POST /api/services/:id/details`
- `GET /api/services/:id/assets`
- `POST /api/services/:id/assets`
- `GET /api/services/:id/jobs`
- `POST /api/services/:id/jobs`
- `GET /api/songs`
- `POST /api/songs`

## Local-First Direction

The current implementation stores files through a small storage helper and keeps REST contracts simple so the project can later support Tauri desktop packaging and local SQLite sync without a major rewrite.
