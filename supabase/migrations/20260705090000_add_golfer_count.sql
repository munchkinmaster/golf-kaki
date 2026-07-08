-- Target headcount for the match (e.g. 4 for a fourball) — the host's pick on
-- Create Game's "Number of golfers" selector. Needed now that a match can be
-- reached two ways (Create Game's own lobby, or Join Game via match code) —
-- both need the same number to show "Players X of Y" / "waiting for N more"
-- and to know when a match is full.
alter table matches add column golfer_count smallint not null default 4 check (golfer_count between 1 and 6);
