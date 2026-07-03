-- Backfills a profiles row for any auth.users that predate the profiles
-- table + on_auth_user_created trigger (added in round_scoring_core,
-- 2026-07-03). Without a row here, the app's profile fetch 406s (PostgREST
-- "no rows" on .single()) and every signed-in screen hangs on its loading
-- state. Mirrors handle_new_user()'s handle-generation exactly so backfilled
-- rows are indistinguishable from trigger-created ones. Idempotent — only
-- touches users who still lack a profile, safe to re-run.
do $$
declare
  u record;
  base_handle text;
  candidate_handle text;
  suffix int;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id = au.id
    where p.id is null
  loop
    base_handle := lower(regexp_replace(split_part(coalesce(u.email, 'golfer'), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
    if base_handle = '' then
      base_handle := 'golfer';
    end if;
    candidate_handle := base_handle;
    suffix := 0;
    while exists (select 1 from public.profiles where handle = candidate_handle) loop
      suffix := suffix + 1;
      candidate_handle := base_handle || suffix::text;
    end loop;

    insert into public.profiles (id, display_name, handle)
    values (u.id, coalesce(u.raw_user_meta_data ->> 'full_name', base_handle), candidate_handle);
  end loop;
end $$;
