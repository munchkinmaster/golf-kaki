-- Two things needed for the tournament flow's next phase (early invites +
-- host-managed per-player settings from the in-round lobby, S6c):
--
-- 1. Skins participation moves from matches.game_settings.sideGames[].
--    participantIds (a shared jsonb blob, host-only-writable as a whole) to
--    its own match_players column. Not just cleanliness — RLS can't grant
--    "edit this one array inside a shared jsonb column" at anything finer
--    than whole-row granularity, so a real per-player column is what makes
--    "the host can flip one player's Skins participation from S6c" a policy
--    that's actually expressible. Participation stays host-managed (per
--    product decision — S6c's lobby tab is not self-service for who's in
--    the pot), so this doesn't need new RLS on its own; it rides the new
--    host-update policy below alongside tee/handicap edits.
--
-- 2. Previously only the player themselves could update their own
--    match_players row ("Players manage their own seat"), and only the host
--    could delete one. Nothing let the HOST update another player's seat
--    post-creation — needed for S6c's host-editable tee/handicap/Skins
--    controls. Same shape as "Host can remove a player from their match".
alter table match_players add column skins_opt_in boolean not null default true;

create policy "Host can update any player's seat in their match" on match_players
  for update using (exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid()));
