-- Match name (e.g. "Sat Fourball") — free text the host sets in Create Game,
-- shown as the header on the lobby, scorecard, and leaderboard. Missing from
-- the original round_scoring_core schema.
alter table matches add column match_name text not null default 'Golf round';
