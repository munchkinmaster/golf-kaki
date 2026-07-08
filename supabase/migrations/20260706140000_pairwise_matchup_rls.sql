-- Kaki Match Play is genuinely pairwise — every pair of players agrees their
-- own strokes ("strokes agreed in the lobby", per data/round.ts), not just
-- each player vs the host. game_matchups already stores any (player_a_id,
-- player_b_id) pair; only the write policies were host-only. Widen them to
-- either participant in the pair, with the host kept as an admin override on
-- every pair (they set up the match and may need to break a tie/fix a typo).
drop policy "Host manages matchup strokes" on game_matchups;
drop policy "Host updates matchup strokes" on game_matchups;

create policy "Matchup participants or host can create" on game_matchups
  for insert with check (
    player_a_id = auth.uid()
    or player_b_id = auth.uid()
    or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid())
  );
create policy "Matchup participants or host can update" on game_matchups
  for update using (
    player_a_id = auth.uid()
    or player_b_id = auth.uid()
    or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid())
  );
