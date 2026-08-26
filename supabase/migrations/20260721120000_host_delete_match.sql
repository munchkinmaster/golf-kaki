-- Lets a host delete their own unfinished round (Rounds > Live tab), so stale
-- lobby/live games don't accumulate. Finished rounds are deliberately excluded
-- from this policy — that history should never be deletable through this path,
-- regardless of what the client sends.
grant delete on matches to authenticated;

create policy "Hosts can delete their unfinished match" on matches
  for delete using (auth.uid() = host_id and status <> 'finished');
