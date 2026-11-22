-- ============================================================
-- Examination Part B: is_part_b + grade_text (Mayura)
-- No conversion_marks. Part A passing_marks stays optional.
-- Safe to re-run (idempotent).
-- ============================================================

-- 1) examination_subjects.is_part_b
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'examination_subjects'
      AND column_name = 'is_part_b'
  ) THEN
    ALTER TABLE public.examination_subjects
      ADD COLUMN is_part_b BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Allow NULL max_marks for Part B rows
DO $$
BEGIN
  ALTER TABLE public.examination_subjects ALTER COLUMN max_marks DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.examination_subjects ALTER COLUMN passing_marks DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop CHECKs that force marks always; replace with Part A / Part B aware constraint
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_subjects'
      AND c.contype = 'c'
  LOOP
    IF r.def ILIKE '%max_marks%' OR r.def ILIKE '%passing_marks%' OR r.conname ILIKE '%part_ab%' THEN
      EXECUTE format('ALTER TABLE public.examination_subjects DROP CONSTRAINT IF EXISTS %I', r.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.examination_subjects
  DROP CONSTRAINT IF EXISTS examination_subjects_part_ab_marks_check;

ALTER TABLE public.examination_subjects
  ADD CONSTRAINT examination_subjects_part_ab_marks_check CHECK (
    (
      is_part_b = FALSE
      AND max_marks IS NOT NULL AND max_marks > 0
      AND (passing_marks IS NULL OR (passing_marks >= 0 AND passing_marks <= max_marks))
    )
    OR
    (
      is_part_b = TRUE
      AND max_marks IS NULL
      AND passing_marks IS NULL
    )
  );

-- Restore time order check if dropped above
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'examination_subjects_time_order_check'
  ) THEN
    ALTER TABLE public.examination_subjects
      ADD CONSTRAINT examination_subjects_time_order_check
      CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_sub_is_part_b
  ON public.examination_subjects (examination_id, is_part_b);

-- 2) examination_result_marks.grade_text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'examination_result_marks'
      AND column_name = 'grade_text'
  ) THEN
    ALTER TABLE public.examination_result_marks
      ADD COLUMN grade_text VARCHAR(50);
  END IF;
END $$;
