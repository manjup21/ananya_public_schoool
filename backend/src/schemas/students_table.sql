CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    date_of_birth DATE NOT NULL,

    roll_number VARCHAR(50) NOT NULL CHECK (LENGTH(BTRIM(roll_number)) > 0),

    class_id UUID NOT NULL,
    section_id UUID,

    address_location TEXT,
    address_city VARCHAR(100),
    address_district VARCHAR(100),
    address_state VARCHAR(100),
    address_pin VARCHAR(12),

    father_name VARCHAR(150) NOT NULL,
    mother_name VARCHAR(150),
    guardian_email VARCHAR(150),
    guardian_phone VARCHAR(30) NOT NULL,
    emergency_contact_number VARCHAR(30),

    blood_group VARCHAR(5) CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    residence_type VARCHAR(20) NOT NULL CHECK (residence_type IN ('day_scholar', 'hosteller')),
    specialisation VARCHAR(150),
    photo_path VARCHAR(255),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_by UUID,
    updated_by UUID,
    deleted_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- FK constraints (kept without cascade to avoid accidental mass deletes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'students'
      AND c.conname = 'fk_students_class'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT fk_students_class
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
      AND t.relname = 'students'
      AND c.conname = 'fk_students_section'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT fk_students_section
      FOREIGN KEY (section_id) REFERENCES sections(id);
  END IF;
END $$;

-- Roll number unique among non-deleted students
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_roll_unique
  ON students (LOWER(BTRIM(roll_number)))
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_section_id ON students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone ON students(guardian_phone);

-- Last name is optional (existing rows keep their values).
ALTER TABLE students ALTER COLUMN last_name DROP NOT NULL;

-- Passport photo relative path under UPLOAD_DIR (e.g. students/MG-0001.jpg)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'photo_path'
  ) THEN
    ALTER TABLE public.students ADD COLUMN photo_path VARCHAR(255);
  END IF;
END $$;

-- Guardian person name → Father; Mother is optional
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'guardian_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'father_name'
  ) THEN
    ALTER TABLE public.students RENAME COLUMN guardian_name TO father_name;
  END IF;
END $$;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_name VARCHAR(150);
