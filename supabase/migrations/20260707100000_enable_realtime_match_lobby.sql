-- Match Lobby only ever learned about other players' changes (a new join, the
-- host adjusting stakes, someone else's pairwise strokes) when the viewer
-- tapped the manual refresh button. Add the lobby's tables to Realtime so the
-- client can subscribe to postgres_changes instead. Guarded with an existence
-- check since a project may already publish these tables (e.g. a `for all
-- tables` publication), which `alter publication ... add table` would error on.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_players'
  ) then
    alter publication supabase_realtime add table match_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_matchups'
  ) then
    alter publication supabase_realtime add table game_matchups;
  end if;
end $$;
