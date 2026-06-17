-- =========================================================
--  AI 이미지 갤러리 — Supabase 초기 설정 SQL
--  Supabase Dashboard > SQL Editor 에 붙여넣고 실행하세요.
--  (모든 테이블 RLS 활성화 + 소유권 기반 정책 포함)
-- =========================================================

-- ---------- 1) 테이블 ----------

-- 사용자 프로필 (auth.users 와 1:1)
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

-- 이미지
create table if not exists public.images (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  image_url   text not null,
  title       text not null,
  description text,
  category    text[] not null default '{}',   -- 다중 카테고리 (배열)
  ai_tool     text,
  created_at  timestamptz not null default now(),
  likes_count integer not null default 0
);
-- updated_at 컬럼 (이미 만든 테이블에도 안전하게 추가)
alter table public.images add column if not exists updated_at timestamptz not null default now();

-- 통계 컬럼 (조회수/다운로드수)
alter table public.images add column if not exists views_count     integer not null default 0;
alter table public.images add column if not exists downloads_count integer not null default 0;

-- 인기 점수 = 조회×1 + 좋아요×2 + 다운로드×3 (자동 계산)
alter table public.images add column if not exists popularity integer
  generated always as (views_count * 1 + likes_count * 2 + downloads_count * 3) stored;
create index if not exists images_popularity_idx on public.images (popularity desc);

create index if not exists images_created_at_idx on public.images (created_at desc);
-- 배열 겹침/포함 검색용 GIN 인덱스
create index if not exists images_category_gin on public.images using gin (category);

-- updated_at 자동 갱신 트리거
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists images_touch_updated_at on public.images;
create trigger images_touch_updated_at
  before update on public.images
  for each row execute function public.touch_updated_at();

-- 좋아요 (선택 기능)
create table if not exists public.likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  image_id   uuid not null references public.images(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, image_id)
);

-- ---------- 2) 트리거: 가입 시 프로필 자동 생성 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3) 트리거: likes_count 동기화 ----------
create or replace function public.sync_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.images set likes_count = likes_count + 1 where id = new.image_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.images set likes_count = greatest(likes_count - 1, 0) where id = old.image_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.sync_likes_count();

-- ---------- 3b) 조회수/다운로드수 증가 RPC ----------
create or replace function public.increment_views(img_id uuid)
returns integer language sql security definer set search_path = '' as $$
  update public.images set views_count = views_count + 1 where id = img_id
  returning views_count;
$$;
create or replace function public.increment_downloads(img_id uuid)
returns integer language sql security definer set search_path = '' as $$
  update public.images set downloads_count = downloads_count + 1 where id = img_id
  returning downloads_count;
$$;
grant execute on function public.increment_views(uuid)     to anon, authenticated;
grant execute on function public.increment_downloads(uuid) to anon, authenticated;

-- ---------- 3c) 유저 레벨 시스템 ----------
alter table public.users add column if not exists total_score integer not null default 0;
alter table public.users add column if not exists level       text    not null default 'Beginner';

create or replace function public.level_for_score(s integer)
returns text language sql immutable as $$
  select case
    when s >= 6000 then 'Grandmaster'
    when s >= 3000 then 'Master'
    when s >= 1500 then 'Expert'
    when s >= 700  then 'Advanced'
    when s >= 300  then 'Intermediate'
    when s >= 100  then 'Novice'
    else 'Beginner'
  end;
$$;

create or replace function public.recalc_owner_score()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid; s integer;
begin
  uid := coalesce(new.user_id, old.user_id);
  if uid is null then return null; end if;
  select coalesce(sum(likes_count * 3 + views_count * 1 + downloads_count * 2), 0) into s
    from public.images where user_id = uid;
  update public.users set total_score = s, level = public.level_for_score(s) where id = uid;
  return null;
end;
$$;

drop trigger if exists images_recalc_score on public.images;
create trigger images_recalc_score
  after insert or delete or update of likes_count, views_count, downloads_count
  on public.images
  for each row execute function public.recalc_owner_score();

-- ---------- 3d) 커뮤니티: 신고 + 팔로우 ----------
alter table public.images add column if not exists reports_count integer not null default 0;

create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references auth.users(id) on delete cascade,
  image_id uuid references public.images(id) on delete cascade,
  reason text, created_at timestamptz default now(),
  unique (reporter_id, image_id)
);
alter table public.reports enable row level security;
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated with check ((select auth.uid()) = reporter_id);
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports for select to authenticated using ((select auth.uid()) = reporter_id);

create or replace function public.sync_reports_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT') then
    update public.images set reports_count = reports_count + 1 where id = new.image_id; return new;
  elsif (tg_op = 'DELETE') then
    update public.images set reports_count = greatest(reports_count - 1, 0) where id = old.image_id; return old;
  end if; return null;
end; $$;
drop trigger if exists reports_count_trigger on public.reports;
create trigger reports_count_trigger after insert or delete on public.reports
  for each row execute function public.sync_reports_count();

create table if not exists public.follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows for select to anon, authenticated using (true);
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows for insert to authenticated with check ((select auth.uid()) = follower_id);
drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows for delete to authenticated using ((select auth.uid()) = follower_id);

-- ---------- 4) RLS 활성화 ----------
alter table public.users  enable row level security;
alter table public.images enable row level security;
alter table public.likes  enable row level security;

-- users: 누구나 프로필 조회 가능(작성자 이름 표시용), 본인만 수정/생성
drop policy if exists users_select_all on public.users;
create policy users_select_all on public.users
  for select to anon, authenticated using (true);

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- images: 전체 공개 조회, 본인만 작성/수정/삭제
drop policy if exists images_select_all on public.images;
create policy images_select_all on public.images
  for select to anon, authenticated using (true);

drop policy if exists images_insert_own on public.images;
create policy images_insert_own on public.images
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists images_update_own on public.images;
create policy images_update_own on public.images
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists images_delete_own on public.images;
create policy images_delete_own on public.images
  for delete to authenticated using ((select auth.uid()) = user_id);

-- likes: 전체 조회, 본인만 좋아요/취소
drop policy if exists likes_select_all on public.likes;
create policy likes_select_all on public.likes
  for select to anon, authenticated using (true);

drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- 5) Storage 버킷 + 정책 ----------
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- 공개 읽기
drop policy if exists img_public_read on storage.objects;
create policy img_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'images');

-- 업로드/수정/삭제: 본인 폴더(user_id/...)만. upsert 위해 insert+update 모두 필요
drop policy if exists img_auth_insert on storage.objects;
create policy img_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists img_auth_update on storage.objects;
create policy img_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists img_auth_delete on storage.objects;
create policy img_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =========================================================
--  완료! 이후 Authentication > Providers 에서 Google/GitHub 활성화,
--  Authentication > URL Configuration 에 사이트 URL을 등록하세요.
-- =========================================================
