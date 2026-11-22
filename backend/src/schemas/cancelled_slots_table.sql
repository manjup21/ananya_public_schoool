CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CANCELLED SLOTS (per-date, per-slot class cancellations)
-- When a class/period is not taken (teacher absent, event, etc.),
-- store one row here.  Attendance calculations exclude these
-- slots from both expected-sessions and absent-sessions.
-- ============================================================

CREATE TABLE IF NOT EXISTS cancelled_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    cancelled_date DATE NOT NULL,
    slot_index INT NOT NULL CHECK (slot_index BETWEEN 1 AND 10),

    class_id UUID NOT NULL,
    section_id UUID,            -- NULL = applies to all sections of the class

    reason TEXT,
    cancelled_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate cancellations for the same context.
-- section_id NULL is treated as a distinct value by UNIQUE, so we need
-- two indexes: one for section-specific and one for class-wide (NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cancelled_slots_with_section
  ON cancelled_slots (cancelled_date, slot_index, class_id, section_id)
  WHERE section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cancelled_slots_no_section
  ON cancelled_slots (cancelled_date, slot_index, class_id)
  WHERE section_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cancelled_slots_date ON cancelled_slots(cancelled_date);
CREATE INDEX IF NOT EXISTS idx_cancelled_slots_class ON cancelled_slots(class_id);
CREATE INDEX IF NOT EXISTS idx_cancelled_slots_date_class ON cancelled_slots(cancelled_date, class_id);

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'cancelled_slots'
      AND c.conname = 'fk_cancelled_slots_class'
  ) THEN
    ALTER TABLE cancelled_slots
      ADD CONSTRAINT fk_cancelled_slots_class
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
      AND t.relname = 'cancelled_slots'
      AND c.conname = 'fk_cancelled_slots_section'
  ) THEN
    ALTER TABLE cancelled_slots
      ADD CONSTRAINT fk_cancelled_slots_section
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
      AND t.relname = 'cancelled_slots'
      AND c.conname = 'fk_cancelled_slots_cancelled_by'
  ) THEN
    ALTER TABLE cancelled_slots
      ADD CONSTRAINT fk_cancelled_slots_cancelled_by
      FOREIGN KEY (cancelled_by) REFERENCES users(id);
  END IF;
END $$;
