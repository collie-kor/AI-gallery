-- =========================================================
--  제목+설명 Full-Text Search (tsvector) — SQL Editor에서 실행 (idempotent)
-- =========================================================

-- 검색용 tsvector 컬럼
alter table public.images add column if not exists search_vector tsvector;

-- 제목 + 설명 → 검색 벡터 자동 갱신 트리거 함수
create or replace function public.update_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    to_tsvector('simple', coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  return new;
end;
$$;

drop trigger if exists images_search_vector_update on public.images;
create trigger images_search_vector_update
  before insert or update on public.images
  for each row execute function public.update_search_vector();

-- 기존 데이터 백필
update public.images set search_vector =
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''));

-- 검색 속도용 GIN 인덱스
create index if not exists images_search_vector_gin on public.images using gin(search_vector);
