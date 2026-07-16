-- Grandfather: anyone who already played a complete, finished 18-hole round
-- under 80 gross strokes before this migration is backfilled with the
-- badge_moments row (and a self-attestation) so they read as earned
-- immediately, same precedent as 20260711120000_badge_attestations.sql's
-- birdie_streak/par_streak backfill.

insert into badge_moments (player_id, match_id, badge_type, course_id, hole_number, achieved_at)
select s.player_id, m.id, 'broke_80', m.course_id, 0, m.finished_at
from matches m
join scores s on s.match_id = m.id
where m.status = 'finished' and m.holes_to_play = 18 and m.finished_at is not null
group by s.player_id, m.id, m.course_id, m.finished_at
having count(*) = 18 and sum(s.gross_strokes) < 80
on conflict (player_id, match_id, badge_type, hole_number) do nothing;

insert into badge_attestations (player_id, badge_type, attested_by)
select distinct player_id, 'broke_80', player_id
from badge_moments
where badge_type = 'broke_80'
on conflict (player_id, badge_type, attested_by) do nothing;
