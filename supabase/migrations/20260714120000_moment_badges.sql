-- Hole-in-One / Eagle badges: one-off per-hole moments (unlike the streak
-- badges, there's no running "best" — either a hole ever qualified or it
-- didn't), detected client-side right after a match finishes from that
-- match's own scores (see src/data/badgeMoments.ts). Same peer-attestation
-- rule as the streak badges: a moment isn't "earned" until a kaki who shared
-- that match roster vouches for it.

alter table badge_attestations drop constraint badge_attestations_badge_type_check;
alter table badge_attestations add constraint badge_attestations_badge_type_check
  check (badge_type in ('birdie_streak', 'par_streak', 'hole_in_one', 'eagle'));

create table badge_moments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles (id) on delete cascade,
  badge_type text not null check (badge_type in ('hole_in_one', 'eagle')),
  match_id uuid not null references matches (id) on delete cascade,
  course_id text not null references courses (id),
  hole_number smallint not null check (hole_number between 1 and 18),
  achieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- A player can eagle more than one hole in a match (or in life) — every
  -- qualifying hole gets its own row, not just the first.
  unique (player_id, match_id, badge_type, hole_number)
);

alter table badge_moments enable row level security;

create policy "Badge moments are publicly readable" on badge_moments
  for select using (true);

-- Mirrors scores' own insert policy: a player can only record a moment for a
-- match they actually sat in, and only for themselves — no host override,
-- since (unlike a scorecard entry) this isn't something a host ever needs to
-- record on someone else's behalf.
create policy "Match participants can record their own badge moments" on badge_moments
  for insert with check (
    player_id = auth.uid()
    and exists (select 1 from match_players mp where mp.match_id = badge_moments.match_id and mp.player_id = auth.uid())
  );

grant select, insert on badge_moments to authenticated;

-- Grandfather: this feature ships after real hole-in-ones/eagles have
-- already happened, so backfill every already-finished match's real scores
-- against that match's actual pars (front/back nine resolved the same way
-- getComboHoles does) rather than leaving history blank.
with hole_par as (
  select
    m.id as match_id,
    m.course_id,
    coalesce(m.finished_at, now()) as achieved_at,
    s.player_id,
    s.hole_number,
    s.gross_strokes,
    ch.par
  from scores s
  join matches m on m.id = s.match_id
  join course_combos cc on cc.course_id = m.course_id and cc.combo_id = m.combo_id
  join course_holes ch
    on ch.course_id = m.course_id
    and ch.nine_id = case when s.hole_number <= 9 then cc.front_nine_id else cc.back_nine_id end
    and ch.hole_n = case when s.hole_number <= 9 then s.hole_number else s.hole_number - 9 end
  where m.status = 'finished'
),
moments as (
  select player_id, 'hole_in_one' as badge_type, match_id, course_id, hole_number, achieved_at
  from hole_par where gross_strokes = 1
  union all
  select player_id, 'eagle' as badge_type, match_id, course_id, hole_number, achieved_at
  from hole_par where gross_strokes - par <= -2
)
insert into badge_moments (player_id, badge_type, match_id, course_id, hole_number, achieved_at)
select player_id, badge_type, match_id, course_id, hole_number, achieved_at from moments
on conflict do nothing;

-- Self-attest every grandfathered moment so it reads as earned immediately —
-- same one-time RLS bypass as the streak grandfather in
-- 20260711120000_badge_attestations.sql (migrations run as postgres, not
-- through RLS, so the "no self-attestation" insert policy doesn't apply here).
insert into badge_attestations (player_id, badge_type, attested_by)
select distinct player_id, badge_type, player_id from badge_moments;
