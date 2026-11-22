CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EXAM TYPES (configurable catalog; default "Others" is system)
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_types' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE exam_types ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
  END IF;
END $$;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn
  FROM exam_types
  WHERE is_system = FALSE
)
UPDATE exam_types t
SET sort_order = r.rn
FROM ranked r
WHERE t.id = r.id;

UPDATE exam_types SET sort_order = 9999 WHERE is_system = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_types_name_unique
  ON exam_types (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_exam_types_is_system ON exam_types (is_system);

CREATE INDEX IF NOT EXISTS idx_exam_types_sort_order
  ON exam_types (is_system, sort_order);

-- Idempotent seed: protected default type (non-editable / non-deletable in app + SQL guards)
INSERT INTO exam_types (id, name, is_system, sort_order)
SELECT uuid_generate_v4(), 'Others', TRUE, 9999
WHERE NOT EXISTS (SELECT 1 FROM exam_types WHERE is_system = TRUE);
