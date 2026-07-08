-- A match that's created but never started sits in 'lobby' status forever —
-- there's no front-end surface that lists lobby matches (RoundsScreen only
-- shows live/finished), so an abandoned lobby is invisible and would
-- otherwise accumulate unnoticed. Auto-expire them server-side instead of
-- relying on anyone remembering to clean up manually.
create extension if not exists pg_cron with schema extensions;

create or replace function delete_stale_lobby_matches()
returns void
language sql
security definer set search_path = public
as $$
  delete from matches
  where status = 'lobby'
    and created_at < now() - interval '48 hours';
$$;

select cron.schedule(
  'delete-stale-lobby-matches',
  '0 * * * *', -- hourly
  $$select delete_stale_lobby_matches();$$
);
