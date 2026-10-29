-- Multi-round lobby (design_handoff_multi_round MR6a/MR6b): a player's tee
-- and Play HC are editable — by them for their own row, by the organiser for
-- anyone's — "until the first score of that round is entered; then locked."
-- The lobby UI hides the edit affordances once a score exists, but a stale
-- screen (or a direct API call) could still write after scoring started and
-- silently change a round mid-play. This makes the database the authority.
--
-- Only guards a CHANGE to an already-set value: joinMatchByCode fills an
-- empty tee_color from the host's on join, and inserts aren't touched at all.
-- Applies to every tournament round, single-round included — the
-- single-round lobby already locks these at "live", which always comes
-- before the first score, so nothing it does today is affected.

create or replace function public.lock_seat_after_first_score()
returns trigger
language plpgsql
as $$
begin
  if (old.tee_color is not null and new.tee_color is distinct from old.tee_color)
     or new.playing_handicap is distinct from old.playing_handicap
     or new.handicap_override is distinct from old.handicap_override then
    if exists (select 1 from scores where match_id = new.match_id) then
      raise exception 'Tee and Play HC are locked once scoring has started for this round'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger match_players_lock_seat_after_first_score
  before update on match_players
  for each row execute function public.lock_seat_after_first_score();
