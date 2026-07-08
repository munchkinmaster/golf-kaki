-- Score entry (ScorecardScreen) only ever learned about another client's
-- writes via manual refresh. Add `scores` to Realtime so the live-round
-- screens can subscribe to postgres_changes, mirroring the Match Lobby's
-- realtime migration. Guarded the same way, in case supabase_realtime
-- already publishes `scores` via some other mechanism.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table scores;
  end if;
end $$;
