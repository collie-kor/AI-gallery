-- =========================================================
--  유저 레벨 시스템
--  점수 = 좋아요×3 + 조회×1 + 다운로드×2 (유저의 모든 이미지 합산)
--  SQL Editor에 전체 붙여넣고 실행. (idempotent)
--  ⚠️ migration-stats.sql(카운트 컬럼)을 먼저 실행한 상태여야 합니다.
-- =========================================================

-- 1) users 테이블에 점수/레벨 컬럼
alter table public.users add column if not exists total_score integer not null default 0;
alter table public.users add column if not exists level       text    not null default 'Beginner';

-- 2) 점수 → 레벨 매핑 함수
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

-- 3) 업로더 점수 재계산 함수 (이미지 카운트 변동 시 호출)
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

-- 4) images의 카운트가 바뀌거나 이미지 추가/삭제 시 자동 재계산
drop trigger if exists images_recalc_score on public.images;
create trigger images_recalc_score
  after insert or delete or update of likes_count, views_count, downloads_count
  on public.images
  for each row execute function public.recalc_owner_score();

-- 5) 기존 데이터 1회 백필
update public.users u set
  total_score = sub.s,
  level = public.level_for_score(sub.s)
from (
  select user_id, coalesce(sum(likes_count * 3 + views_count * 1 + downloads_count * 2), 0)::int s
  from public.images group by user_id
) sub
where u.id = sub.user_id;
