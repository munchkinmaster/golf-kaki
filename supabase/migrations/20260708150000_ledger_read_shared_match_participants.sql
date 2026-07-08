-- kaki_relationships' read policy only let the two people IN a relationship
-- see it. But fetchLedgerStrokesForGroup (data/kaki.ts) seeds the WHOLE
-- pairwise carry-forward matrix for a match's roster — every player vs every
-- other player, not just vs the one viewer calling it — mirroring the same
-- "host sees every pair" admin view that game_matchups already grants (see
-- 20260707120000_matchup_read_all_participants.sql for the identical fix on
-- that table). For a viewer who isn't part of a given pair (most visibly: the
-- host, whose Lobby view renders all pairs, not just their own), that pair's
-- row was invisible, so the ledger fetch silently dropped it and the UI
-- showed 0 strokes / "no handicap yet" instead of the real carry-forward
-- value — even though the two actual participants could see it fine from
-- their own accounts.
--
-- Widen: a viewer can also read a kaki_relationships row if both its players
-- share a match roster with them. This is an additional permissive policy —
-- Postgres OR's it with the existing "participants can read their own" policy
-- rather than replacing it.
create policy "Match co-participants can read shared kaki relationships" on kaki_relationships
  for select using (
    exists (
      select 1
      from match_players mp_self
      join match_players mp_a on mp_a.match_id = mp_self.match_id and mp_a.player_id = kaki_relationships.player_a_id
      join match_players mp_b on mp_b.match_id = mp_self.match_id and mp_b.player_id = kaki_relationships.player_b_id
      where mp_self.player_id = auth.uid()
    )
  );
