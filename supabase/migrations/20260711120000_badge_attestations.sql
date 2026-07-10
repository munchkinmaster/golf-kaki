-- Peer attestation for the two streak badges (birdie_streak, par_streak) —
-- a streak crossing its threshold isn't "earned" until a kaki who actually
-- shared a match roster with the player vouches for it. One attestation
-- (from anyone eligible) is enough; it covers the badge type permanently,
-- regardless of how much further the streak grows afterward.

create table badge_attestations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles (id) on delete cascade,
  badge_type text not null check (badge_type in ('birdie_streak', 'par_streak')),
  attested_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, badge_type, attested_by)
);

alter table badge_attestations enable row level security;

create policy "Badge attestations are publicly readable" on badge_attestations
  for select using (true);

-- Only a kaki who has actually shared a match roster with the badge owner
-- can attest it, and never for their own badge. Same "shared match
-- co-participant" join shape as
-- 20260708150000_ledger_read_shared_match_participants.sql's RLS widening.
create policy "Match co-participants can attest each other's badges" on badge_attestations
  for insert with check (
    attested_by = auth.uid()
    and player_id <> auth.uid()
    and exists (
      select 1
      from match_players mp_self
      join match_players mp_target
        on mp_target.match_id = mp_self.match_id
        and mp_target.player_id = badge_attestations.player_id
      where mp_self.player_id = auth.uid()
    )
  );

grant select, insert on badge_attestations to authenticated;

-- Grandfather: anyone who already qualifies for a streak badge as of this
-- migration is backfilled with a self-attestation so they read as earned
-- immediately, with no special-casing needed anywhere in app code. This is
-- a one-time migration-level bypass of the "no self-attestation" rule above
-- (migrations run as postgres, not through RLS) — going forward, the RLS
-- insert policy makes self-attestation impossible for real users.
insert into badge_attestations (player_id, badge_type, attested_by)
select id, 'birdie_streak', id from profiles where birdie_streak_best >= 3
union all
select id, 'par_streak', id from profiles where par_streak_best >= 3;
