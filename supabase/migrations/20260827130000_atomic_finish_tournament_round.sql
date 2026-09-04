-- Tournament rounds had the exact same silent-staleness problem
-- 20260730120000_atomic_finish_match.sql already fixed for Kaki Match Play:
-- finishTournamentRound was a plain matches.status update, and every
-- player's handicap differential was only ever recorded by THEIR OWN client,
-- self-scoped, the next time THEY personally opened a screen for that round
-- (see recalculateAndSaveHandicap's call sites). A player who never revisits
-- a finished round — a synthetic/test account, someone who closes the app
-- right after their last hole, whatever — silently never gets that round's
-- differential written, with nothing surfacing the miss. Confirmed live:
-- a player with 4 finished rounds had only 2 handicap_differentials on file.
--
-- finish_tournament_round() does the whole roster's differentials in one
-- privileged transaction at finish time, same shape as finish_match(): the
-- host's client computes each player's Score Differential (needs course/SI
-- data + that match's own scores, all readable by any match participant —
-- see the "Match participants can read scores" policy) via the EXACT SAME
-- TypeScript math every other differential write already uses
-- (computeDifferentialForPlayer in src/data/handicap.ts — nothing here
-- reimplements that; only the WRITE moves server-side), then hands the
-- computed numbers to this function as plain JSON. This function is
-- security definer (bypasses RLS on handicap_differentials/profiles, both
-- normally self-only-writable), so the seated check below is the actual
-- authorization boundary, not RLS — same caveat finish_match's own comment
-- makes about its ledger writes.
--
-- The Handicap Index recompute (best-N-of-most-recent-20, per Rule 5.2a) IS
-- done here in SQL rather than passed in, because — unlike the differential,
-- which only needs THIS match's data — the index needs each player's FULL
-- differential history, which the finishing host can't read (differentials
-- are select-own-only). Running the recompute inside this security-definer
-- function sidesteps that cleanly. Mirrors computeHandicapIndex in
-- src/data/handicap.ts exactly — keep the two in sync if that table ever
-- changes.
create or replace function public.finish_tournament_round(p_match_id uuid, p_differentials jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_tournament_id uuid;
  v_finished_at timestamptz := now();
  d jsonb;
  v_player_id uuid;
  v_differential numeric;
  v_count int;
  v_take int;
  v_adjustment numeric;
  v_avg numeric;
  v_index numeric;
begin
  select host_id, tournament_id into v_host_id, v_tournament_id from matches where id = p_match_id for update;
  if v_host_id is null then
    raise exception 'match not found';
  end if;
  if v_tournament_id is null then
    raise exception 'not a tournament round — use finish_match for Kaki Match Play';
  end if;
  if auth.uid() is distinct from v_host_id then
    raise exception 'only the host can finish this round';
  end if;

  update matches set status = 'finished', finished_at = v_finished_at where id = p_match_id;

  -- p_differentials: [{ player_id, differential }, ...], one entry per
  -- seated player computeDifferentialForPlayer resolved a value for (an
  -- ineligible player — no rating data, incomplete card — is simply absent,
  -- same as recalculateAndSaveHandicap's own silent no-op for them).
  for d in select * from jsonb_array_elements(coalesce(p_differentials, '[]'::jsonb))
  loop
    v_player_id := (d ->> 'player_id')::uuid;
    v_differential := (d ->> 'differential')::numeric;

    if not exists (select 1 from match_players where match_id = p_match_id and player_id = v_player_id and status = 'joined') then
      continue;
    end if;

    insert into handicap_differentials (player_id, match_id, differential, played_at)
    values (v_player_id, p_match_id, v_differential, v_finished_at)
    on conflict (player_id, match_id) do nothing;

    -- Rule 5.2a "For Fewer Than 20 Scores" — same LOW_ROUND_TABLE as
    -- lookupLowRoundRule in src/data/handicap.ts. Below 3 scores there's no
    -- index yet, so profiles.handicap is left untouched (stays whatever it
    -- already was — null for a brand new player).
    select count(*) into v_count from (
      select 1 from handicap_differentials where player_id = v_player_id order by played_at desc limit 20
    ) recent;
    if v_count < 3 then
      continue;
    end if;

    v_take := case
      when v_count in (3, 4, 5) then 1
      when v_count = 6 then 2
      when v_count in (7, 8) then 2
      when v_count between 9 and 11 then 3
      when v_count between 12 and 14 then 4
      when v_count between 15 and 16 then 5
      when v_count between 17 and 18 then 6
      when v_count = 19 then 7
      else 8
    end;
    v_adjustment := case
      when v_count = 3 then -2.0
      when v_count = 4 then -1.0
      when v_count = 6 then -1.0
      else 0.0
    end;

    select avg(differential) into v_avg from (
      select differential from (
        select differential from handicap_differentials
        where player_id = v_player_id
        order by played_at desc
        limit 20
      ) recent
      order by differential asc
      limit v_take
    ) lowest;

    v_index := trunc(0.96 * v_avg + v_adjustment, 1);
    update profiles set handicap = v_index where id = v_player_id;
  end loop;

  return v_finished_at;
end;
$$;

grant execute on function public.finish_tournament_round(uuid, jsonb) to authenticated;
