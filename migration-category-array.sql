-- =========================================================
--  images.category : text → text[] (배열) 전환 + 옛 체크제약 제거
--  ⚠️ SQL Editor에 "전체"를 그대로 붙여넣고 한 번 실행하세요.
--  어떤 현재 상태(텍스트/배열, 제약 유무)에서도 안전하게 동작합니다.
-- =========================================================

-- 1) 옛 체크 제약 제거 (이름이 달라도 대비해 동적으로 모두 제거)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.images'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.images drop constraint %I', r.conname);
  end loop;
end $$;

-- 2) 컬럼이 아직 배열이 아니면 배열로 변환 (기존 단일값 → 1개짜리 배열, 데이터 보존)
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'images' and column_name = 'category') <> 'ARRAY' then
    alter table public.images alter column category drop default;
    alter table public.images
      alter column category type text[]
      using (case when category is null or category::text = '' then '{}'::text[]
                  else array[category::text] end);
    alter table public.images alter column category set default '{}';
    alter table public.images alter column category set not null;
  end if;
end $$;

-- 3) 배열 겹침/검색용 GIN 인덱스
create index if not exists images_category_gin on public.images using gin (category);

-- 확인용 (실행 후 결과 보기)
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.images'::regclass;
-- select column_name, data_type from information_schema.columns where table_name='images' and column_name='category';
