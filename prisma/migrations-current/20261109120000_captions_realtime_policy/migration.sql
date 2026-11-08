-- Live captions are pushed to listeners' phones on private Realtime Broadcast channels named
-- "captions:<listener link token>". Listeners may only RECEIVE on those channels; nobody but the server
-- (which uses the secret key and bypasses this policy) may send. The unguessable token in the channel
-- name is the gate, the same as for the public caption page.
-- Guarded so a plain Postgres (for example Prisma's shadow database) without the Supabase Realtime schema is unaffected.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "captions_listeners_receive" ON realtime.messages;
    CREATE POLICY "captions_listeners_receive" ON realtime.messages
      FOR SELECT TO anon, authenticated
      USING (extension = 'broadcast' AND realtime.topic() LIKE 'captions:%');
  END IF;
END
$$;
