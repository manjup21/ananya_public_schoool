CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STUDENT ABSENCES (ABSENCES-ONLY ATTENDANCE STORAGE)
-- Store a row when a student is absent for a given date and slot.
-- Present count is derived from attendance patterns - absences.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_id UUID NOT NULL,
    absent_date DATE NOT NULL,
    slot_index INT NOT NULL DEFAULT 1 CHECK (slot_index BETWEEN 1 AND 10),

    -- Optional fields
    reason TEXT,

    created_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (student_id, absent_date, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_student_absences_date ON student_absences(absent_date);
CREATE INDEX IF NOT EXISTS idx_student_absences_student_date ON student_absences(student_id, absent_date);
CREATE INDEX IF NOT EXISTS idx_student_absences_date_slot ON student_absences(absent_date, slot_index);

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'student_absences'
      AND c.conname = 'fk_student_absences_student'
  ) THEN
    ALTER TABLE student_absences
      ADD CONSTRAINT fk_student_absences_student
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'student_absences'
      AND c.conname = 'fk_student_absences_created_by'
  ) THEN
    ALTER TABLE student_absences
      ADD CONSTRAINT fk_student_absences_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;
