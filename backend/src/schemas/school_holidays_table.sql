CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.school_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_school_holidays_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_school_holidays_active_range
  ON public.school_holidays (is_active, start_date, end_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'school_holidays'
      AND c.conname = 'fk_school_holidays_created_by'
  ) THEN
    ALTER TABLE public.school_holidays
      ADD CONSTRAINT fk_school_holidays_created_by
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
      AND t.relname = 'school_holidays'
      AND c.conname = 'fk_school_holidays_updated_by'
  ) THEN
    ALTER TABLE public.school_holidays
      ADD CONSTRAINT fk_school_holidays_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;
