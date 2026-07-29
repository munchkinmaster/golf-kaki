-- Finishing a round used to be two separate client round-trips: flip
-- matches.status to 'finished', then a second call (syncLedger) to write the
-- pairwise carry-forward into kaki_relationships. That split write caused two
-- problems: (1) if the client died between the two calls (offline host,
-- battery died), the match already looked "finished" everywhere but the
-- ledger was never settled, with nothing left to retry it — Home's Live-round
-- list filters on status='live', so the match had already dropped off the one
-- screen that could re-open Finish; and (2) to route around kaki_relationships'
-- own RLS (only the two people IN a pair may write it, no host override — see
-- its policies in 20260703120000_round_scoring_core.sql), every viewer's own
-- Recap re-ran the same sync on mount so their own pairs eventually caught up.
-- That made re-opening an OLDER match's Recap after a NEWER match had already
-- updated the same pair's ledger silently drag it backwards in time.
--
-- finish_match() does both writes in one transaction, as the host, in one
-- call: either none of it commits (match stays 'live', fully retryable from
-- Home same as before) or all of it does (status flip + every pairwise deal
-- together). Recap no longer writes anything — it's display only.
create or replace function public.finish_match(p_match_id uuid, p_deals jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_finished_at timestamptz := now();
  d jsonb;
  v_a uuid;
  v_b uuid;
  v_net numeric;
begin
  select host_id into v_host_id from matches where id = p_match_id for update;
  if v_host_id is null then
    raise exception 'match not found';
  end if;
  if auth.uid() is distinct from v_host_id then
    raise exception 'only the host can finish this match';
  end if;

  update matches set status = 'finished', finished_at = v_finished_at where id = p_match_id;

  -- p_deals: [{ player_a_id, player_b_id, net_strokes_per_9 }, ...], already
  -- canonicalized (player_a_id < player_b_id) the same way round.ts's
  -- getNextRoundNet keys its map — see finishMatchAndSettleLedger. This
  -- function is security definer (bypasses RLS on the tables it touches), so
  -- the seated check below is the actual authorization boundary, not RLS:
  -- without it a compromised host client could settle a ledger for any two
  -- players, not just ones actually in this match.
  for d in select * from jsonb_array_elements(coalesce(p_deals, '[]'::jsonb))
  loop
    v_a := (d ->> 'player_a_id')::uuid;
    v_b := (d ->> 'player_b_id')::uuid;
    v_net := (d ->> 'net_strokes_per_9')::numeric;

    if not exists (select 1 from match_players where match_id = p_match_id and player_id = v_a and status = 'joined')
       or not exists (select 1 from match_players where match_id = p_match_id and player_id = v_b and status = 'joined')
    then
      continue;
    end if;

    -- Plain update, never insert — a pair with no accepted kaki relationship
    -- yet silently no-ops, same as the updateLedgerStrokes it replaces.
    update kaki_relationships
    set net_strokes_per_9 = v_net
    where player_a_id = v_a and player_b_id = v_b and status = 'accepted';
  end loop;

  return v_finished_at;
end;
$$;

grant execute on function public.finish_match(uuid, jsonb) to authenticated;
