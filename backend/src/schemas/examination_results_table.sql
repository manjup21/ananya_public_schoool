CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EXAMINATION RESULTS (STUDENT MARKS STORAGE)
-- - examination_results: one row per (exam, student)
-- - examination_result_marks: one row per (result, subject)
-- ============================================================

CREATE TABLE IF NOT EXISTS examination_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    examination_id UUID NOT NULL,
    student_id UUID NOT NULL,

    -- Optional summary fields (can be computed later too)
    total_marks INT,
    result_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (result_status IN ('draft', 'submitted', 'published')),

    created_by UUID,
    updated_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (examination_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_results_exam_id ON examination_results(examination_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_id ON examination_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_status ON examination_results(result_status);

CREATE TABLE IF NOT EXISTS examination_result_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    result_id UUID NOT NULL,
    subject_id UUID NOT NULL,

    -- Part A: mark / is_absent. Part B: grade_text (max 50).
    mark INT,
    is_absent BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT,
    grade_text VARCHAR(50),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (result_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_result_marks_result_id ON examination_result_marks(result_id);
CREATE INDEX IF NOT EXISTS idx_exam_result_marks_subject_id ON examination_result_marks(subject_id);

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_results'
      AND c.conname = 'fk_exam_results_exam'
  ) THEN
    ALTER TABLE examination_results
      ADD CONSTRAINT fk_exam_results_exam
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
      AND t.relname = 'examination_results'
      AND c.conname = 'fk_exam_results_student'
  ) THEN
    ALTER TABLE examination_results
      ADD CONSTRAINT fk_exam_results_student
      FOREIGN KEY (student_id) REFERENCES students(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_results'
      AND c.conname = 'fk_exam_results_created_by'
  ) THEN
    ALTER TABLE examination_results
      ADD CONSTRAINT fk_exam_results_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_results'
      AND c.conname = 'fk_exam_results_updated_by'
  ) THEN
    ALTER TABLE examination_results
      ADD CONSTRAINT fk_exam_results_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_result_marks'
      AND c.conname = 'fk_exam_result_marks_result'
  ) THEN
    ALTER TABLE examination_result_marks
      ADD CONSTRAINT fk_exam_result_marks_result
      FOREIGN KEY (result_id) REFERENCES examination_results(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'examination_result_marks'
      AND c.conname = 'fk_exam_result_marks_subject'
  ) THEN
    ALTER TABLE examination_result_marks
      ADD CONSTRAINT fk_exam_result_marks_subject
      FOREIGN KEY (subject_id) REFERENCES subjects(id);
  END IF;
END $$;

