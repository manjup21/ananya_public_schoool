CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Needed for exclusion constraints that mix (=) with ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- ATTENDANCE CONFIGURATION (PATTERNS)
-- UI uses:
-- - Pattern Name
-- - Scope: global | class | section
-- - Optional class_id (required for class/section scopes)
-- - Optional section_id (required for section scope)
-- - Date range: start_date..end_date (inclusive)
-- - Days of week: 0=Sun .. 6=Sat
-- - Slots per day + per-slot time (HH:MM, stored as TIME)
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(150) NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'class', 'section')),

    class_id UUID,
    section_id UUID,

    -- Groups patterns created in a single call (used for multi-section creation).
    batch_id UUID,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID,
    updated_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Scope rules
    CHECK (
      (scope = 'global' AND class_id IS NULL AND section_id IS NULL)
      OR (scope = 'class' AND class_id IS NOT NULL AND section_id IS NULL)
      OR (scope = 'section' AND class_id IS NOT NULL AND section_id IS NOT NULL)
    ),

    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_att_patterns_scope ON attendance_patterns(scope);
CREATE INDEX IF NOT EXISTS idx_att_patterns_class_id ON attendance_patterns(class_id);
CREATE INDEX IF NOT EXISTS idx_att_patterns_section_id ON attendance_patterns(section_id);
CREATE INDEX IF NOT EXISTS idx_att_patterns_batch_id ON attendance_patterns(batch_id);
CREATE INDEX IF NOT EXISTS idx_att_patterns_date_range ON attendance_patterns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_att_patterns_is_active ON attendance_patterns(is_active);

-- Prevent exact duplicates among active patterns (same scope + same target + same date range)
-- Note: partial unique index allows reusing the same tuple when older pattern is deactivated.
CREATE UNIQUE INDEX IF NOT EXISTS uq_att_patterns_active_exact
  ON attendance_patterns (scope, class_id, section_id, start_date, end_date)
  WHERE is_active = TRUE;

-- Prevent overlapping date ranges among active patterns (VERY IMPORTANT)
-- Rule:
-- - Only one active pattern can apply to the same target (scope/class/section) for any overlapping dates.
-- Uses daterange(start_date, end_date, '[]') => inclusive both ends.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'excl_att_patterns_global_overlap'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT excl_att_patterns_global_overlap
      EXCLUDE USING gist (
        scope WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      )
      WHERE (is_active = TRUE AND scope = 'global');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'excl_att_patterns_class_overlap'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT excl_att_patterns_class_overlap
      EXCLUDE USING gist (
        scope WITH =,
        class_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      )
      WHERE (is_active = TRUE AND scope = 'class');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'excl_att_patterns_section_overlap'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT excl_att_patterns_section_overlap
      EXCLUDE USING gist (
        scope WITH =,
        class_id WITH =,
        section_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      )
      WHERE (is_active = TRUE AND scope = 'section');
  END IF;
END $$;

-- Days-of-week mapping table (one row per selected day)
CREATE TABLE IF NOT EXISTS attendance_pattern_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id UUID NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    UNIQUE (pattern_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_att_pat_days_pattern_id ON attendance_pattern_days(pattern_id);

-- Slot definitions (one row per slot; day_of_week NULL = same for all days)
CREATE TABLE IF NOT EXISTS attendance_pattern_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id UUID NOT NULL,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
    slot_index INT NOT NULL CHECK (slot_index BETWEEN 1 AND 10),
    slot_name VARCHAR(50),
    slot_time TIME
);

CREATE INDEX IF NOT EXISTS idx_att_pat_slots_pattern_id ON attendance_pattern_slots(pattern_id);

-- Unique slot index per context (pattern + day)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'attendance_pattern_slots'
      AND c.contype = 'u'
      AND c.conname = 'uq_att_pat_slots_context_index'
  ) THEN
    ALTER TABLE public.attendance_pattern_slots
      ADD CONSTRAINT uq_att_pat_slots_context_index UNIQUE (pattern_id, day_of_week, slot_index);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_att_pat_slots_context_name_ci
  ON public.attendance_pattern_slots (pattern_id, day_of_week, LOWER(slot_name))
  WHERE slot_name IS NOT NULL;

-- Add columns on existing DBs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_pattern_slots' AND column_name = 'day_of_week'
  ) THEN
    ALTER TABLE public.attendance_pattern_slots ADD COLUMN day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_pattern_slots' AND column_name = 'slot_name'
  ) THEN
    ALTER TABLE public.attendance_pattern_slots ADD COLUMN slot_name VARCHAR(50);
  END IF;
END $$;

-- Make slot_time nullable on existing DBs
DO $$
DECLARE v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'attendance_pattern_slots' AND column_name = 'slot_time';
  IF v_is_nullable = 'NO' THEN
    ALTER TABLE public.attendance_pattern_slots ALTER COLUMN slot_time DROP NOT NULL;
  END IF;
END $$;

-- Backfill slot names for existing rows
UPDATE public.attendance_pattern_slots
SET slot_name = 'Slot ' || slot_index::text
WHERE slot_name IS NULL OR BTRIM(slot_name) = '';

-- Legacy unique(pattern_id, slot_index) blocks per-day slots (same index on each day).
-- Replaced by uq_att_pat_slots_context_index (pattern_id, day_of_week, slot_index).
ALTER TABLE public.attendance_pattern_slots
  DROP CONSTRAINT IF EXISTS attendance_pattern_slots_pattern_id_slot_index_key;

-- Foreign keys (idempotent, keep naming consistent with existing schema files)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'fk_att_patterns_class'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT fk_att_patterns_class
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
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'fk_att_patterns_section'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT fk_att_patterns_section
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
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'fk_att_patterns_created_by'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT fk_att_patterns_created_by
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
      AND t.relname = 'attendance_patterns'
      AND c.conname = 'fk_att_patterns_updated_by'
  ) THEN
    ALTER TABLE attendance_patterns
      ADD CONSTRAINT fk_att_patterns_updated_by
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
      AND t.relname = 'attendance_pattern_days'
      AND c.conname = 'fk_att_pat_days_pattern'
  ) THEN
    ALTER TABLE attendance_pattern_days
      ADD CONSTRAINT fk_att_pat_days_pattern
      FOREIGN KEY (pattern_id) REFERENCES attendance_patterns(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'attendance_pattern_slots'
      AND c.conname = 'fk_att_pat_slots_pattern'
  ) THEN
    ALTER TABLE attendance_pattern_slots
      ADD CONSTRAINT fk_att_pat_slots_pattern
      FOREIGN KEY (pattern_id) REFERENCES attendance_patterns(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Re-apply overlap constraints so only ACTIVE patterns block duplicates.
-- Older DBs may have constraints without the is_active predicate, which blocks re-create after delete.
ALTER TABLE attendance_patterns DROP CONSTRAINT IF EXISTS excl_att_patterns_global_overlap;
ALTER TABLE attendance_patterns DROP CONSTRAINT IF EXISTS excl_att_patterns_class_overlap;
ALTER TABLE attendance_patterns DROP CONSTRAINT IF EXISTS excl_att_patterns_section_overlap;

ALTER TABLE attendance_patterns
  ADD CONSTRAINT excl_att_patterns_global_overlap
  EXCLUDE USING gist (
    scope WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (is_active = TRUE AND scope = 'global');

ALTER TABLE attendance_patterns
  ADD CONSTRAINT excl_att_patterns_class_overlap
  EXCLUDE USING gist (
    scope WITH =,
    class_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (is_active = TRUE AND scope = 'class');

ALTER TABLE attendance_patterns
  ADD CONSTRAINT excl_att_patterns_section_overlap
  EXCLUDE USING gist (
    scope WITH =,
    class_id WITH =,
    section_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (is_active = TRUE AND scope = 'section');

