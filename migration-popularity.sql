-- =========================================================
--  인기 점수(popularity) 생성 컬럼
--  점수 = 조회수×1 + 좋아요×2 + 다운로드×3
--  base 컬럼이 바뀌면 자동으로 다시 계산됩니다 (STORED).
--  ⚠️ migration-stats.sql 을 먼저 실행한 뒤에 실행하세요.
-- =========================================================

alter table public.images
  add column if not exists popularity integer
  generated always as (views_count * 1 + likes_count * 2 + downloads_count * 3) stored;

create index if not exists images_popularity_idx on public.images (popularity desc);
