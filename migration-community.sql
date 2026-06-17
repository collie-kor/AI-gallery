-- =========================================================
--  커뮤니티 기능: 신고(reports) + 팔로우(follows)
--  Supabase SQL Editor에 전체 붙여넣고 실행. (idempotent)
-- =========================================================

-- ===== 1) 신고 =====
create table if not exists public.reports (
  id          uuid default gen_random_uuid() primary key,
  reporter_id uuid references auth.users(id) on delete cascade,
  image_id    uuid references public.images(id) on delete cascade,
  reason      text,
  created_at  timestamptz default now(),
  unique (reporter_id, image_id)
);

-- 누적 신고수 (갤러리 블러 판단용) — reports를 직접 안 읽고 이 값만 조회
alter table public.images add column if not exists reports_count integer not null default 0;

alter table public.reports enable row level security;

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated using ((select auth.uid()) = reporter_id);

create or replace function public.sync_reports_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT') then
    update public.images set reports_count = reports_count + 1 where id = new.image_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.images set reports_count = greatest(reports_count - 1, 0) where id = old.image_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists reports_count_trigger on public.reports;
create trigger reports_count_trigger
  after insert or delete on public.reports
  for each row execute function public.sync_reports_count();

-- ===== 2) 팔로우 =====
create table if not exists public.follows (
  id           uuid default gen_random_uuid() primary key,
  follower_id  uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)   -- 본인 팔로우 금지
);

alter table public.follows enable row level security;

drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows
  for select to anon, authenticated using (true);

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows
  for insert to authenticated with check ((select auth.uid()) = follower_id);

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows
  for delete to authenticated using ((select auth.uid()) = follower_id);
