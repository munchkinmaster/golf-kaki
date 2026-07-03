-- Core round/scoring schema: profiles, kaki (friend) relationships with their
-- persistent stroke ledger, matches, match participants, per-match stroke
-- allowances, and hole-by-hole scores. Mirrors the Kaki Match Play engine:
--   - kaki_relationships.net_strokes_per_9 is the durable, per-friendship
--     ledger (decimal — see comment on the column for why).
--   - game_matchups holds the integer strokes actually applied to ONE match,
--     derived from the ledger at creation time and never fed back into it
--     directly; only the end-of-match re-strike touches the ledger.
--   - Tournaments (multi-round series with shared standings) deliberately
--     aren't modeled here — structurally distinct, additive later via a
--     `tournaments` table + nullable `matches.tournament_id`.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4-char match code (GK-XXXX in the UI) — excludes 0/O/1/I to avoid
-- misreads when a host reads it aloud or a player copies it by hand.
create or replace function generate_match_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from matches where match_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  handle text not null unique,
  handicap numeric(4, 1),
  bio text,
  -- Storage object path (e.g. "avatars/<user_id>/<file>"), not a full URL —
  -- resolved client-side via the storage helper so it survives bucket/domain
  -- changes. Null until the user uploads a photo.
  avatar_path text,
  -- Free-form, display-only, user-typed (e.g. "Singapore") — no geocoding or
  -- distance features depend on this today.
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row the moment someone signs up (Google or email) —
-- nothing else in this schema works without one. Handle defaults to the
-- email's local part, de-duplicated with a numeric suffix on collision;
-- the user can change it later from Profile.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_handle text;
  candidate_handle text;
  suffix int := 0;
begin
  base_handle := lower(regexp_replace(split_part(coalesce(new.email, 'golfer'), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if base_handle = '' then
    base_handle := 'golfer';
  end if;
  candidate_handle := base_handle;
  while exists (select 1 from profiles where handle = candidate_handle) loop
    suffix := suffix + 1;
    candidate_handle := base_handle || suffix::text;
  end loop;

  insert into profiles (id, display_name, handle)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', base_handle), candidate_handle);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- kaki_relationships — friendship + the persistent stroke ledger
-- ---------------------------------------------------------------------------

create table kaki_relationships (
  id uuid primary key default gen_random_uuid(),
  -- Canonicalized so a pair has exactly one row regardless of who's "a" —
  -- sign of net_strokes_per_9 then carries the give/get direction.
  player_a_id uuid not null references profiles (id) on delete cascade,
  player_b_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references profiles (id),
  -- Decimal, not integer: an 18-hole-basis match earns strokes in units of
  -- 0.5 per 9 (see calculateNewLedgerBalance) — e.g. a pair settled at "A
  -- gives B 3 over 18" carries forward as 1.5 per 9, and integer storage
  -- would silently truncate that. Positive = player_a gives to player_b;
  -- negative = player_a receives from player_b.
  net_strokes_per_9 numeric(4, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_a_id < player_b_id),
  unique (player_a_id, player_b_id)
);

create trigger kaki_relationships_set_updated_at
  before update on kaki_relationships
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------

create table matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles (id),
  course_id text not null references courses (id),
  combo_id text not null,
  -- How many holes THIS match is being played over.
  holes_to_play smallint not null check (holes_to_play in (9, 18)),
  -- The "Strokes set for" lobby toggle — independent of holes_to_play, but
  -- can only be 9 when holes_to_play is 9 (enforced below, UI also disables
  -- the 18 option in that case). Basis 9 + holes_to_play 18 is the one
  -- combination with a mid-match re-strike at the turn; every other
  -- combination holds its strokes flat for the whole match.
  strokes_basis smallint not null check (strokes_basis in (9, 18)),
  game_mode text not null default 'kaki_match_play',
  -- Mode-specific config (e.g. {"skin_value": 5} for Skins) so future modes
  -- don't need a schema migration for every new tunable.
  game_settings jsonb not null default '{}'::jsonb,
  stake_per_hole numeric(6, 2) not null default 0,
  status text not null default 'lobby' check (status in ('lobby', 'live', 'finished')),
  match_code text not null unique default generate_match_code(),
  thru smallint not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  foreign key (course_id, combo_id) references course_combos (course_id, combo_id),
  check (holes_to_play = 18 or strokes_basis = 9)
);

-- ---------------------------------------------------------------------------
-- match_players
-- ---------------------------------------------------------------------------

create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  player_id uuid not null references profiles (id),
  is_host boolean not null default false,
  -- Snapshot at join time — handicap drifts over time, past matches shouldn't.
  handicap_at_time numeric(4, 1),
  joined_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- ---------------------------------------------------------------------------
-- game_matchups — per-pair, per-match applied strokes (integers, ephemeral)
-- ---------------------------------------------------------------------------

create table game_matchups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  player_a_id uuid not null references profiles (id),
  player_b_id uuid not null references profiles (id),
  -- Same sign convention as kaki_relationships: positive = a gives b.
  front_nine_strokes smallint not null default 0,
  -- Only ever set (and only ever differs from front_nine_strokes) for the
  -- [holes_to_play=18, strokes_basis=9] case, once the turn's re-strike runs.
  back_nine_strokes smallint,
  check (player_a_id < player_b_id),
  unique (match_id, player_a_id, player_b_id)
);

-- ---------------------------------------------------------------------------
-- scores — hole-by-hole gross strokes
-- ---------------------------------------------------------------------------

create table scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  player_id uuid not null references profiles (id),
  hole_number smallint not null check (hole_number between 1 and 18),
  gross_strokes smallint not null check (gross_strokes > 0),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id, hole_number)
);

create trigger scores_set_updated_at
  before update on scores
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table kaki_relationships enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table game_matchups enable row level security;
alter table scores enable row level security;

-- RLS only filters rows a role is already granted table-level access to —
-- without these, every query below fails with "permission denied for table
-- ..." before RLS is even evaluated. No `anon` grants: every policy here
-- requires auth.uid() is not null, so signed-out requests have nothing to
-- read or write regardless.
grant select, update on profiles to authenticated;
grant select, insert, update, delete on kaki_relationships to authenticated;
grant select, insert, update on matches to authenticated;
grant select, insert on match_players to authenticated;
grant select, insert, update on game_matchups to authenticated;
grant select, insert, update on scores to authenticated;

-- profiles: readable by any signed-in user (names/avatars show up throughout
-- the app for opponents and friends); writable only by the owner. Inserts
-- only ever happen via the trigger above, so no insert policy is needed.
create policy "Profiles are readable by signed-in users" on profiles
  for select using (auth.uid() is not null);
create policy "Users can update their own profile" on profiles
  for update using (id = auth.uid());

-- kaki_relationships: only the two people in the relationship can see or
-- touch it.
create policy "Participants can read their kaki relationships" on kaki_relationships
  for select using (auth.uid() = player_a_id or auth.uid() = player_b_id);
create policy "Participants can create a kaki relationship" on kaki_relationships
  for insert with check (
    auth.uid() = requested_by and (auth.uid() = player_a_id or auth.uid() = player_b_id)
  );
create policy "Participants can update their kaki relationship" on kaki_relationships
  for update using (auth.uid() = player_a_id or auth.uid() = player_b_id);
-- Declining a request or unfriending both just remove the row — there's no
-- separate "declined" status to track.
create policy "Participants can remove their kaki relationship" on kaki_relationships
  for delete using (auth.uid() = player_a_id or auth.uid() = player_b_id);

-- matches: kept permissive at the row level (course, mode, stake, code
-- aren't sensitive) — visible to any signed-in user, matching join-by-code
-- needing to work for people who aren't friends with the host yet. Writable
-- only by the host. Note: this does NOT mean anyone can see live scores —
-- scores/game_matchups below are locked to participants specifically.
create policy "Matches are readable by signed-in users" on matches
  for select using (auth.uid() is not null);
create policy "Hosts can create matches" on matches
  for insert with check (auth.uid() = host_id);
create policy "Hosts can update their match" on matches
  for update using (auth.uid() = host_id);

-- match_players: same permissive-read stance as matches; joining a match
-- inserts your own row, or the host can add someone.
create policy "Match players are readable by signed-in users" on match_players
  for select using (auth.uid() is not null);
create policy "Players can join, hosts can add players" on match_players
  for insert with check (
    player_id = auth.uid()
    or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid())
  );

-- game_matchups: only the pair involved, or the match host, can read; only
-- the host can write (mirrors the lobby UI, where only the host configures
-- strokes).
create policy "Matchup participants and host can read" on game_matchups
  for select using (
    player_a_id = auth.uid()
    or player_b_id = auth.uid()
    or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid())
  );
create policy "Host manages matchup strokes" on game_matchups
  for insert with check (exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid()));
create policy "Host updates matchup strokes" on game_matchups
  for update using (exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid()));

-- scores: only match participants can read; a player writes their own card,
-- the host can write anyone's (mirrors ScorecardScreen's canEdit()).
create policy "Match participants can read scores" on scores
  for select using (
    exists (select 1 from match_players mp where mp.match_id = scores.match_id and mp.player_id = auth.uid())
  );
create policy "Own score or host can write scores" on scores
  for insert with check (
    player_id = auth.uid()
    or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid())
  );
create policy "Own score or host can update scores" on scores
  for update using (
    player_id = auth.uid()
    or exists (select 1 from matches m where m.id = match_id and m.host_id = auth.uid())
  );
