-- 1. item_uid 컬럼 추가 (고유값 보장, 중복 방식 방지)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS item_uid TEXT UNIQUE;

-- 2. 기존 데이터가 있다면 UID 채워 넣기 (임시)
UPDATE public.inventory SET item_uid = gen_random_uuid()::text WHERE item_uid IS NULL;

-- 3. NOT NULL 제약 추가
ALTER TABLE public.inventory ALTER COLUMN item_uid SET NOT NULL;
