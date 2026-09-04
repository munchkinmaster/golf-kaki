-- Neither ScorecardScreen.canEdit() (Kaki Match Play) nor
-- useTournamentRound.canEditPlayer() (tournaments) ever checked match
-- status, and "Own score or host can write scores"/"Own score or update
-- scores" (20260703120000_round_scoring_core.sql) didn't either — so a
-- finished match's scorecard was exactly as writable as a live one, at
-- every layer, forever. Confirmed live: a player who stayed on the
-- Scorecard screen after the host finished the round could still tap the
-- +/- stepper and have it persist.
--
-- That's not just a stale-UI annoyance — TournamentFinishScreen's standings
-- are computed LIVE off current `scores` every time it's viewed (same as
-- every other tournament screen — see useTournamentRound's docblock), so a
-- late edit silently changes what everyone else already saw as the final
-- result. FinishScreen's own copy already promised "Once finished, scores
-- lock and the round moves to everyone's history" — this migration is what
-- actually makes that true, at the RLS layer (the real trust boundary in
-- this app — see CLAUDE.md), not just client-side.
--
-- Scoped to `scores` only — match_players (tee/handicap seat edits, Skins
-- opt-in) isn't part of what the reported bug was about, and locking it too
-- would need its own separate reasoning about whether a host ever
-- legitimately needs to touch a seat post-finish. Left untouched here.
drop policy if exists "Own score or host can write scores" on scores;
create policy "Own score or host can write scores" on scores
  for insert with check (
    (player_id = auth.uid() or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid()))
    and not exists (select 1 from matches m where m.id = match_id and m.status = 'finished')
  );

drop policy if exists "Own score or host can update scores" on scores;
create policy "Own score or host can update scores" on scores
  for update using (
    (player_id = auth.uid() or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid()))
    and not exists (select 1 from matches m where m.id = match_id and m.status = 'finished')
  );
