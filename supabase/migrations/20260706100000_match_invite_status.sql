-- Match invites: a host-invited friend was previously seated immediately
-- (silent auto-join, no consent) — this adds a real pending state so they
-- get a notification with accept/reject instead. 'joined' covers both the
-- host's own seat and anyone who joined themselves (Join Game by code);
-- 'invited' is only for a friend the host picked in Create Game's invite
-- list, until they act on it.
alter table match_players add column status text not null default 'joined' check (status in ('invited', 'joined'));

-- Previously only insert was needed (host seats everyone at creation, or a
-- player seats themselves by code). Accepting/declining an invite is the
-- invitee updating/removing their own row.
grant update, delete on match_players to authenticated;

create policy "Players manage their own seat" on match_players
  for update using (player_id = auth.uid());
create policy "Players can leave or decline their seat" on match_players
  for delete using (player_id = auth.uid());
