CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EXAMINATIONS
-- Requires exam_types (see exam_types_table.sql) applied before this file on fresh installs.
-- - section_id optional (exam can be for whole class)
-- - examination_subjects: one row per (exam, subject) with max_marks + passing_marks
-- - examinations.max_marks / passing_marks = sum of those rows (see examinations_functions)
-- ============================================================

CREATE TABLE IF NOT EXISTS examinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    test_name VARCHAR(150) NOT NULL,
    exam_type_id UUID NOT NULL,
    exam_status VARCHAR(20) NOT NULL CHECK (exam_status IN ('scheduled', 'completed', 'cancelled')),

    class_id UUID NOT NULL,
    section_id UUID,

    exam_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,

    max_marks INT NOT NULL CHECK (max_marks > 0),
    passing_marks INT CHECK (passing_marks IS NULL OR passing_marks >= 0),

    invigilator VARCHAR(150),
    instructions TEXT,

    created_by UUID,
    updated_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (end_time > start_time),
    CHECK (passing_marks IS NULL OR passing_marks <= max_marks)
);

-- Make time + invigilator optional on existing DBs too
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'examinations'
      AND column_name = 'start_time'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE examinations ALTER COLUMN start_time DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'examinations'
      AND column_name = 'end_time'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE examinations ALTER COLUMN end_time DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'examinations'
      AND column_name = 'invigilator'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE examinations ALTER COLUMN invigilator DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exams_class_id ON examinations(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_section_id ON examinations(section_id);
CREATE INDEX IF NOT EXISTS idx_exams_date ON examinations(exam_date);
CREATE INDEX IF NOT EXISTS idx_exams_status ON examinations(exam_status);
CREATE INDEX IF NOT EXISTS idx_exams_exam_type_id ON examinations(exam_type_id);

CREATE TABLE IF NOT EXISTS examination_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    examination_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    -- Part A: max_marks required, passing optional. Part B: both NULL.
    max_marks INT,
    passing_marks INT,
    is_part_b BOOLEAN NOT NULL DEFAULT FALSE,
    exam_date DATE,
    start_time TIME,
    end_time TIME,
    UNIQUE (examination_id, subject_id),
    CHECK (
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
    ),
    CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_exam_sub_exam_id ON examination_subjects(examination_id);
CREATE INDEX IF NOT EXISTS idx_exam_sub_subject_id ON examination_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_sub_schedule ON examination_subjects(examination_id, exam_date, start_time);
CREATE INDEX IF NOT EXISTS idx_exam_sub_is_part_b ON examination_subjects(examination_id, is_part_b);

-- Per-subject schedule (idempotent for existing DBs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'examination_subjects' AND column_name = 'exam_date'
  ) THEN
    ALTER TABLE examination_subjects ADD COLUMN exam_date DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'examination_subjects' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE examination_subjects ADD COLUMN start_time TIME;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'examination_subjects' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE examination_subjects ADD COLUMN end_time TIME;
  END IF;
END $$;

-- Backfill from parent exam, then require exam_date
UPDATE examination_subjects es
SET
  exam_date = COALESCE(es.exam_date, e.exam_date),
  start_time = COALESCE(es.start_time, e.start_time),
  end_time = COALESCE(es.end_time, e.end_time)
FROM examinations e
WHERE e.id = es.examination_id
  AND (es.exam_date IS NULL OR (es.start_time IS NULL AND e.start_time IS NOT NULL) OR (es.end_time IS NULL AND e.end_time IS NOT NULL));

UPDATE examination_subjects es
SET exam_date = e.exam_date
FROM examinations e
WHERE e.id = es.examination_id AND es.exam_date IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'examination_subjects'
      AND column_name = 'exam_date'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE examination_subjects ALTER COLUMN exam_date SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'examination_subjects_time_order_check'
  ) THEN
    ALTER TABLE examination_subjects
      ADD CONSTRAINT examination_subjects_time_order_check
      CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time);
  END IF;
END $$;

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examinations'
      AND c.conname = 'fk_exams_exam_type'
  ) THEN
    ALTER TABLE examinations
      ADD CONSTRAINT fk_exams_exam_type
      FOREIGN KEY (exam_type_id) REFERENCES exam_types(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examinations'
      AND c.conname = 'fk_exams_class'
  ) THEN
    ALTER TABLE examinations
      ADD CONSTRAINT fk_exams_class
      FOREIGN KEY (class_id) REFERENCES classes(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examinations'
      AND c.conname = 'fk_exams_section'
  ) THEN
    ALTER TABLE examinations
      ADD CONSTRAINT fk_exams_section
      FOREIGN KEY (section_id) REFERENCES sections(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_subjects'
      AND c.conname = 'fk_exam_sub_exam'
  ) THEN
    ALTER TABLE examination_subjects
      ADD CONSTRAINT fk_exam_sub_exam
      FOREIGN KEY (examination_id) REFERENCES examinations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_subjects'
      AND c.conname = 'fk_exam_sub_subject'
  ) THEN
    ALTER TABLE examination_subjects
      ADD CONSTRAINT fk_exam_sub_subject
      FOREIGN KEY (subject_id) REFERENCES subjects(id);
  END IF;
END $$;

-- Multi-section targeting: one exam can target multiple sections
CREATE TABLE IF NOT EXISTS public.examination_sections (
  examination_id UUID NOT NULL,
  section_id UUID NOT NULL,
  PRIMARY KEY (examination_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_sections_section_id ON public.examination_sections(section_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_sections'
      AND c.conname = 'fk_exam_sections_exam'
  ) THEN
    ALTER TABLE public.examination_sections
      ADD CONSTRAINT fk_exam_sections_exam
      FOREIGN KEY (examination_id) REFERENCES public.examinations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_sections'
      AND c.conname = 'fk_exam_sections_section'
  ) THEN
    ALTER TABLE public.examination_sections
      ADD CONSTRAINT fk_exam_sections_section
      FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Passing marks are optional (NULL = not applied)
ALTER TABLE public.examinations ALTER COLUMN passing_marks DROP NOT NULL;
ALTER TABLE public.examination_subjects ALTER COLUMN passing_marks DROP NOT NULL;

