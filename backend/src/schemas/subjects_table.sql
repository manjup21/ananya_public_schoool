CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID,
    updated_by UUID,
    deleted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subjects' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE subjects ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
  END IF;
END $$;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn
  FROM subjects
  WHERE is_deleted = FALSE
)
UPDATE subjects s
SET sort_order = r.rn
FROM ranked r
WHERE s.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_name_unique
  ON subjects (LOWER(name))
  WHERE is_deleted = FALSE;

-- Optional subject code: unique among non-deleted rows when provided (NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_code_unique
  ON subjects (LOWER(code))
  WHERE is_deleted = FALSE AND code IS NOT NULL AND BTRIM(code) <> '';

CREATE INDEX IF NOT EXISTS idx_subjects_sort_order
  ON subjects (is_deleted, sort_order);
