CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STUDENT FEES
-- One row per student per academic year.
-- net_fee is a stored generated column: total_fee - discount.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_id UUID NOT NULL,
    academic_year VARCHAR(20) NOT NULL,

    total_fee NUMERIC(12,2) NOT NULL CHECK (total_fee >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    net_fee NUMERIC(12,2) GENERATED ALWAYS AS (total_fee - discount) STORED,

    due_date DATE,
    notes TEXT,

    created_by UUID,
    updated_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (discount <= total_fee),
    CHECK (LENGTH(BTRIM(academic_year)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_fees_student_year
    ON student_fees (student_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_student_fees_academic_year
    ON student_fees (academic_year);

-- Add due_date on existing DBs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_fees'
      AND column_name = 'due_date'
  ) THEN
    ALTER TABLE public.student_fees ADD COLUMN due_date DATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_fees_due_date
    ON student_fees (due_date) WHERE due_date IS NOT NULL;

-- FK: student_fees.student_id -> students(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'student_fees'
      AND c.conname = 'fk_student_fees_student'
  ) THEN
    ALTER TABLE student_fees
      ADD CONSTRAINT fk_student_fees_student
      FOREIGN KEY (student_id) REFERENCES students(id);
  END IF;
END $$;


-- ============================================================
-- FEE PAYMENTS
-- Append-only ledger of payments against a student_fee record.
-- gateway_* columns are nullable — used only when a payment
-- gateway is integrated in the future. Manual entries leave them NULL.
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_fee_id UUID NOT NULL,

    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,

    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN (
        'cash', 'cheque', 'bank_transfer', 'upi', 'online', 'other'
    )),

    reference_number VARCHAR(100),
    receipt_number VARCHAR(50),

    gateway_order_id VARCHAR(200),
    gateway_payment_id VARCHAR(200),
    gateway_status VARCHAR(30) CHECK (
        gateway_status IS NULL
        OR gateway_status IN ('created', 'captured', 'failed', 'refunded')
    ),

    notes TEXT,

    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student_fee_id
    ON fee_payments (student_fee_id);

CREATE INDEX IF NOT EXISTS idx_fee_payments_payment_date
    ON fee_payments (payment_date);

-- FK: fee_payments.student_fee_id -> student_fees(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'fee_payments'
      AND c.conname = 'fk_fee_payments_student_fee'
  ) THEN
    ALTER TABLE fee_payments
      ADD CONSTRAINT fk_fee_payments_student_fee
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================
-- STUDENT FEE ITEMS
-- Named line items under a student_fees row (tuition, bus, etc.).
-- Totals on student_fees remain source of truth for balance/payments.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_fee_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_fee_id UUID NOT NULL,

    fee_name VARCHAR(120) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    notes TEXT,

    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (discount <= amount),
    CHECK (LENGTH(BTRIM(fee_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_student_fee_items_student_fee_id
    ON student_fee_items (student_fee_id);

CREATE INDEX IF NOT EXISTS idx_student_fee_items_created_at
    ON student_fee_items (student_fee_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'student_fee_items'
      AND c.conname = 'fk_student_fee_items_student_fee'
  ) THEN
    ALTER TABLE student_fee_items
      ADD CONSTRAINT fk_student_fee_items_student_fee
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE;
  END IF;
END $$;
