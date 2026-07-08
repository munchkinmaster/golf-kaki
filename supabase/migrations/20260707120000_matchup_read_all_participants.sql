-- game_matchups' read policy only let a viewer see pairs THEY were part of
-- (or the host, who could see everything). But the back-9 re-strike gate
-- (buildBackNineDeals in useLiveRound.ts) requires every pair in the roster
-- to be visible before it shows deals for ANY pair -- for a non-host viewer
-- in a 4+ player match, the pairs not involving them were always invisible,
-- so that gate could never pass and their screen permanently fell back to
-- front-9 flags. Any match participant needs to see the whole pairwise
-- table, same as they already can for `scores`.
drop policy "Matchup participants and host can read" on game_matchups;

create policy "Match participants can read all matchups" on game_matchups
  for select using (
    exists (select 1 from match_players mp where mp.match_id = game_matchups.match_id and mp.player_id = auth.uid())
  );
