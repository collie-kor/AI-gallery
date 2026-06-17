-- =========================================================
--  좋아요 / 조회수 / 다운로드수 기능
--  SQL Editor에 전체를 붙여넣고 실행하세요. (idempotent)
-- =========================================================

-- 1) 카운트 컬럼 (likes_count는 기존에 있음)
alter table public.images add column if not exists likes_count     integer not null default 0;
alter table public.images add column if not exists views_count     integer not null default 0;
alter table public.images add column if not exists downloads_count integer not null default 0;

-- 2) 좋아요 테이블 (없으면 생성)
create table if not exists public.likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  image_id   uuid not null references public.images(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, image_id)
);

alter table public.likes enable row level security;

drop policy if exists likes_select_all on public.likes;
create policy likes_select_all on public.likes
  for select to anon, authenticated using (true);

drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3) likes_count 동기화 트리거
create or replace function public.sync_likes_count()
returns trigger language plpgsql security definer set search_path = '' as $$
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

-- 4) 조회수/다운로드수 증가 RPC (비로그인 포함 누구나 호출 가능, 카운터만 증가)
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
