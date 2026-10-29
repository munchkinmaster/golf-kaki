-- MR11 "Set up next round" (design_handoff_multi_round): the organiser
-- confirms a later round's course on the day and who's playing. One call,
-- one transaction — the round's match, its seats and the schedule link
-- either all land or none do, so a dropped connection can't leave a match
-- with no seats or a schedule row pointing at nothing.
--
-- security invoker on purpose: every write here is one the organiser can
-- already make under RLS (host inserts matches / adds and removes seats /
-- updates their tournament's rounds). The function only adds atomicity and
-- the round-order checks below.
--
-- p_players: [{ player_id, handicap_index, tee_color, playing_handicap }, ...]
-- — only the players who are PLAYING this round (MR11 switches on).
-- Everyone else on the roster is DNS for it, which is derived (no seat),
-- never stored. Play HC is computed client-side from the new course's tee
-- ratings (same computeCourseHandicap/computePlayingHandicap every other
-- seat write uses — the math isn't reimplemented here).
--
-- Re-confirming a round that's already set up (MR11 is "editable until the
-- first score is entered") updates its match in place: course, start hole,
-- seats added/removed, tees and Play HC rewritten. Once any score exists it
-- refuses, same cutoff as lock_seat_after_first_score().

create or replace function public.setup_tournament_round(
  p_tournament_id uuid,
  p_round_index smallint,
  p_course_id text,
  p_combo_id text,
  p_start_hole smallint,
  p_players jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_tournament tournaments%rowtype;
  v_round tournament_rounds%rowtype;
  v_prev_match uuid;
  v_prev_status text;
  v_settings jsonb;
  v_match_id uuid;
  p jsonb;
  v_player_ids uuid[];
begin
  select * into v_tournament from tournaments where id = p_tournament_id;
  if v_tournament.id is null then
    raise exception 'tournament not found';
  end if;
  if v_tournament.host_id is distinct from auth.uid() then
    raise exception 'only the organiser can set up a round';
  end if;
  if p_round_index < 2 then
    raise exception 'Round 1 is set up when the tournament is created';
  end if;
  if jsonb_array_length(coalesce(p_players, '[]'::jsonb)) = 0 then
    raise exception 'at least one player has to be playing';
  end if;

  select * into v_round from tournament_rounds
  where tournament_id = p_tournament_id and round_index = p_round_index
  for update;
  if v_round.id is null then
    raise exception 'round % not found', p_round_index;
  end if;

  select r.match_id, m.status, m.game_settings into v_prev_match, v_prev_status, v_settings
  from tournament_rounds r left join matches m on m.id = r.match_id
  where r.tournament_id = p_tournament_id and r.round_index = p_round_index - 1;
  if v_prev_match is null or v_prev_status is distinct from 'finished' then
    raise exception 'Round % has to finish before Round % can be set up', p_round_index - 1, p_round_index;
  end if;

  select array_agg((x ->> 'player_id')::uuid) into v_player_ids from jsonb_array_elements(p_players) x;

  if v_round.match_id is null then
    insert into matches (host_id, course_id, combo_id, holes_to_play, strokes_basis, start_hole, match_name, game_mode, golfer_count, tournament_id, game_settings)
    values (auth.uid(), p_course_id, p_combo_id, 18, 18, p_start_hole, v_tournament.name, v_tournament.scoring_format,
            jsonb_array_length(p_players), p_tournament_id, coalesce(v_settings, '{}'::jsonb))
    returning id into v_match_id;
    update tournament_rounds set match_id = v_match_id where id = v_round.id;
  else
    v_match_id := v_round.match_id;
    if exists (select 1 from scores where match_id = v_match_id) then
      raise exception 'Round % has started — its course and players are locked', p_round_index;
    end if;
    update matches
    set course_id = p_course_id, combo_id = p_combo_id, start_hole = p_start_hole, golfer_count = jsonb_array_length(p_players)
    where id = v_match_id;
    delete from match_players where match_id = v_match_id and player_id <> all (v_player_ids);
  end if;

  for p in select * from jsonb_array_elements(p_players)
  loop
    insert into match_players (match_id, player_id, is_host, handicap_at_time, status, tee_color, playing_handicap, handicap_override)
    values (
      v_match_id,
      (p ->> 'player_id')::uuid,
      (p ->> 'player_id')::uuid = v_tournament.host_id,
      (p ->> 'handicap_index')::numeric,
      'joined',
      p ->> 'tee_color',
      (p ->> 'playing_handicap')::smallint,
      false
    )
    on conflict (match_id, player_id) do update
    set handicap_at_time = excluded.handicap_at_time,
        tee_color = excluded.tee_color,
        playing_handicap = excluded.playing_handicap,
        handicap_override = false;
  end loop;

  return v_match_id;
end;
$$;

grant execute on function public.setup_tournament_round(uuid, smallint, text, text, smallint, jsonb) to authenticated;
