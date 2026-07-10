-- Admin auth: an email allowlist for the course-admin surface (admin/), plus
-- write policies on the course catalog tables that were previously
-- select-only-to-everyone with no insert/update/delete path at all (see
-- 20260628120000_course_catalog.sql). Kept as its own `admins` table rather
-- than a role column on `profiles` — the allowlist has nothing to do with
-- the mobile app's player identity and shouldn't touch that table.
--
-- is_admin() is security definer so it can read `admins` regardless of the
-- caller's own RLS visibility into that table — `admins` itself has RLS
-- enabled with no policies, so no authenticated user can enumerate the
-- admin list directly, only check membership via this function.

create table admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

grant execute on function public.is_admin() to authenticated;

insert into admins (email) values ('pyter85@hotmail.com');

-- Write policies for the course catalog. Reads stay as the existing public
-- select-using(true) policies from course_catalog.sql / handicap_index.sql.

grant insert, update, delete on courses, course_nines, course_holes, course_combos, course_combo_ratings to authenticated;

create policy "Admins can insert courses" on courses for insert to authenticated with check (is_admin());
create policy "Admins can update courses" on courses for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can delete courses" on courses for delete to authenticated using (is_admin());

create policy "Admins can insert course nines" on course_nines for insert to authenticated with check (is_admin());
create policy "Admins can update course nines" on course_nines for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can delete course nines" on course_nines for delete to authenticated using (is_admin());

create policy "Admins can insert course holes" on course_holes for insert to authenticated with check (is_admin());
create policy "Admins can update course holes" on course_holes for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can delete course holes" on course_holes for delete to authenticated using (is_admin());

create policy "Admins can insert course combos" on course_combos for insert to authenticated with check (is_admin());
create policy "Admins can update course combos" on course_combos for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can delete course combos" on course_combos for delete to authenticated using (is_admin());

create policy "Admins can insert course combo ratings" on course_combo_ratings for insert to authenticated with check (is_admin());
create policy "Admins can update course combo ratings" on course_combo_ratings for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can delete course combo ratings" on course_combo_ratings for delete to authenticated using (is_admin());
