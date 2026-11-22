-- ============================================================
-- STUDENT FEES FUNCTIONS (ATR-style procedures)
-- - Assign / update fee for a student + academic year
-- - Record manual (or future gateway) payments
-- - Query fee details, payment history, and dashboard summary
--
-- Transaction safety:
-- Each function call is atomic. If any statement fails,
-- PostgreSQL rolls back the whole call.
-- ============================================================


-- Upsert a fee record for a student + academic year.
-- Default: replace total_fee / discount / due_date / notes; replace fee items with one named item.
-- When p_add_to_existing: add total_fee and discount onto the existing row;
-- due_date / notes overwrite only when provided (keep existing if null); append a named fee item.
DROP FUNCTION IF EXISTS public.atr_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, DATE, TEXT, UUID);
DROP FUNCTION IF EXISTS public.atr_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, DATE, TEXT, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.atr_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, DATE, TEXT, UUID, BOOLEAN, VARCHAR);
DROP FUNCTION IF EXISTS public.atr_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.atr_assign_student_fee(
  p_student_id UUID,
  p_academic_year VARCHAR,
  p_total_fee NUMERIC,
  p_discount NUMERIC DEFAULT 0,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_add_to_existing BOOLEAN DEFAULT FALSE,
  p_fee_name VARCHAR DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_is_update BOOLEAN := FALSE;
  v_paid NUMERIC;
  v_old_total NUMERIC;
  v_old_discount NUMERIC;
  v_new_net NUMERIC;
  v_clean_notes TEXT;
  v_clean_fee_name VARCHAR;
  v_add BOOLEAN := COALESCE(p_add_to_existing, FALSE);
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_academic_year IS NULL OR BTRIM(p_academic_year) = '' THEN
    RETURN QUERY SELECT 400, 'academic_year is required', NULL::jsonb; RETURN;
  END IF;
  IF p_fee_name IS NULL OR BTRIM(p_fee_name) = '' THEN
    RETURN QUERY SELECT 400, 'fee_name is required', NULL::jsonb; RETURN;
  END IF;
  v_clean_fee_name := LEFT(BTRIM(p_fee_name), 120);
  IF p_total_fee IS NULL OR p_total_fee < 0 THEN
    RETURN QUERY SELECT 400, 'total_fee must be 0 or more', NULL::jsonb; RETURN;
  END IF;
  IF p_discount IS NULL OR p_discount < 0 THEN
    RETURN QUERY SELECT 400, 'discount must be 0 or more', NULL::jsonb; RETURN;
  END IF;
  IF p_discount > p_total_fee THEN
    RETURN QUERY SELECT 400, 'discount cannot exceed total_fee', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;

  v_clean_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  -- Check if resulting net_fee would put paid amount over balance
  SELECT id, total_fee, discount INTO v_id, v_old_total, v_old_discount
  FROM student_fees
  WHERE student_id = p_student_id AND academic_year = BTRIM(p_academic_year);

  IF v_id IS NOT NULL THEN
    v_is_update := TRUE;
    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM fee_payments
    WHERE student_fee_id = v_id;

    IF v_add THEN
      v_new_net := (COALESCE(v_old_total, 0) + p_total_fee)
        - (COALESCE(v_old_discount, 0) + COALESCE(p_discount, 0));
    ELSE
      v_new_net := p_total_fee - COALESCE(p_discount, 0);
    END IF;

    IF v_paid > v_new_net THEN
      RETURN QUERY SELECT 400,
        'Cannot reduce net fee below already paid amount (' || v_paid::text || ')',
        NULL::jsonb;
      RETURN;
    END IF;
  END IF;

  INSERT INTO student_fees (student_id, academic_year, total_fee, discount, due_date, notes, created_by, updated_by)
  VALUES (
    p_student_id,
    BTRIM(p_academic_year),
    p_total_fee,
    COALESCE(p_discount, 0),
    p_due_date,
    v_clean_notes,
    p_actor_user_id,
    p_actor_user_id
  )
  ON CONFLICT (student_id, academic_year)
  DO UPDATE SET
    total_fee = CASE
      WHEN v_add THEN student_fees.total_fee + EXCLUDED.total_fee
      ELSE EXCLUDED.total_fee
    END,
    discount = CASE
      WHEN v_add THEN student_fees.discount + EXCLUDED.discount
      ELSE EXCLUDED.discount
    END,
    due_date = CASE
      WHEN v_add THEN COALESCE(EXCLUDED.due_date, student_fees.due_date)
      ELSE EXCLUDED.due_date
    END,
    notes = CASE
      WHEN v_add THEN COALESCE(EXCLUDED.notes, student_fees.notes)
      ELSE EXCLUDED.notes
    END,
    updated_by = p_actor_user_id,
    updated_at = NOW()
  RETURNING id INTO v_id;

  IF NOT v_add THEN
    DELETE FROM student_fee_items WHERE student_fee_id = v_id;
  END IF;

  INSERT INTO student_fee_items (student_fee_id, fee_name, amount, discount, notes, created_by)
  VALUES (
    v_id,
    v_clean_fee_name,
    p_total_fee,
    COALESCE(p_discount, 0),
    v_clean_notes,
    p_actor_user_id
  );

  RETURN QUERY SELECT
    CASE WHEN v_is_update THEN 200 ELSE 201 END,
    CASE
      WHEN v_is_update AND v_add THEN 'Fee increased successfully'
      WHEN v_is_update THEN 'Fee updated successfully'
      ELSE 'Fee assigned successfully'
    END,
    jsonb_build_object('id', v_id);
EXCEPTION
  WHEN check_violation THEN
    RETURN QUERY SELECT 400, 'Invalid fee values: ' || SQLERRM, NULL::jsonb;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Record a payment against a student's fee record.
-- Prevents overpayment (paid_so_far + amount > net_fee).
-- gateway_* fields are optional — only populated by future gateway integration.
CREATE OR REPLACE FUNCTION public.atr_record_fee_payment(
  p_student_fee_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_method VARCHAR,
  p_reference_number VARCHAR DEFAULT NULL,
  p_receipt_number VARCHAR DEFAULT NULL,
  p_gateway_order_id VARCHAR DEFAULT NULL,
  p_gateway_payment_id VARCHAR DEFAULT NULL,
  p_gateway_status VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_net_fee NUMERIC;
  v_paid NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF p_student_fee_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_fee_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT 400, 'amount must be greater than 0', NULL::jsonb; RETURN;
  END IF;
  IF p_payment_date IS NULL THEN
    RETURN QUERY SELECT 400, 'payment_date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN (
    'cash', 'cheque', 'bank_transfer', 'upi', 'online', 'other'
  ) THEN
    RETURN QUERY SELECT 400, 'Valid payment_method is required (cash, cheque, bank_transfer, upi, online, other)', NULL::jsonb; RETURN;
  END IF;

  -- Lock the fee row to prevent concurrent overpayment
  SELECT net_fee INTO v_net_fee
  FROM student_fees
  WHERE id = p_student_fee_id
  FOR UPDATE;

  IF v_net_fee IS NULL THEN
    RETURN QUERY SELECT 404, 'Fee record not found', NULL::jsonb; RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM fee_payments
  WHERE student_fee_id = p_student_fee_id;

  v_balance := v_net_fee - v_paid;

  IF p_amount > v_balance THEN
    RETURN QUERY SELECT 400,
      'Payment amount (' || p_amount::text || ') exceeds outstanding balance (' || v_balance::text || ')',
      NULL::jsonb;
    RETURN;
  END IF;

  INSERT INTO fee_payments (
    student_fee_id, amount, payment_date, payment_method,
    reference_number, receipt_number,
    gateway_order_id, gateway_payment_id, gateway_status,
    notes, created_by
  ) VALUES (
    p_student_fee_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    NULLIF(BTRIM(COALESCE(p_reference_number, '')), ''),
    NULLIF(BTRIM(COALESCE(p_receipt_number, '')), ''),
    NULLIF(BTRIM(COALESCE(p_gateway_order_id, '')), ''),
    NULLIF(BTRIM(COALESCE(p_gateway_payment_id, '')), ''),
    NULLIF(BTRIM(COALESCE(p_gateway_status, '')), ''),
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    p_actor_user_id
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 201,
    'Payment recorded successfully',
    jsonb_build_object(
      'id', v_id,
      'paid_total', v_paid + p_amount,
      'balance', v_balance - p_amount
    );
EXCEPTION
  WHEN check_violation THEN
    RETURN QUERY SELECT 400, 'Invalid payment values: ' || SQLERRM, NULL::jsonb;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Get fee detail for a single student (by student_id + optional academic_year).
-- Returns fee record, total paid, balance, and recent payment list.
CREATE OR REPLACE FUNCTION public.atr_get_student_fee(
  p_student_id UUID,
  p_academic_year VARCHAR DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;

  SELECT jsonb_build_object(
    'fees', COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.academic_year DESC), '[]'::jsonb)
  ) INTO v_row
  FROM (
    SELECT
      sf.id,
      sf.student_id,
      sf.academic_year,
      sf.total_fee,
      sf.discount,
      sf.net_fee,
      sf.due_date,
      sf.notes,
      sf.created_at,
      sf.updated_at,
      COALESCE(paid.total_paid, 0) AS total_paid,
      sf.net_fee - COALESCE(paid.total_paid, 0) AS balance,
      COALESCE(paid.payment_count, 0) AS payment_count,
      COALESCE(paid.last_payment_date, NULL) AS last_payment_date,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', fp.id,
              'amount', fp.amount,
              'payment_date', fp.payment_date,
              'payment_method', fp.payment_method,
              'reference_number', fp.reference_number,
              'receipt_number', fp.receipt_number,
              'gateway_payment_id', fp.gateway_payment_id,
              'notes', fp.notes,
              'created_at', fp.created_at
            )
            ORDER BY fp.payment_date DESC, fp.created_at DESC
          )
          FROM fee_payments fp
          WHERE fp.student_fee_id = sf.id
        ),
        '[]'::jsonb
      ) AS payments,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', fi.id,
              'fee_name', fi.fee_name,
              'amount', fi.amount,
              'discount', fi.discount,
              'net', fi.amount - fi.discount,
              'notes', fi.notes,
              'created_at', fi.created_at
            )
            ORDER BY fi.created_at ASC, fi.id ASC
          )
          FROM student_fee_items fi
          WHERE fi.student_fee_id = sf.id
        ),
        '[]'::jsonb
      ) AS fee_items
    FROM student_fees sf
    LEFT JOIN LATERAL (
      SELECT
        SUM(fp.amount) AS total_paid,
        COUNT(*) AS payment_count,
        MAX(fp.payment_date) AS last_payment_date
      FROM fee_payments fp
      WHERE fp.student_fee_id = sf.id
    ) paid ON TRUE
    WHERE sf.student_id = p_student_id
      AND (p_academic_year IS NULL OR sf.academic_year = BTRIM(p_academic_year))
  ) x;

  IF v_row IS NULL OR v_row->'fees' = '[]'::jsonb THEN
    RETURN QUERY SELECT 404, 'No fee records found for this student', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY SELECT 200, 'Student fee fetched successfully', v_row;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Admin list view: all students with fee summary for a given academic year.
-- Supports search (name/roll_number), filter by class/section.
CREATE OR REPLACE FUNCTION public.atr_list_student_fees(
  p_academic_year VARCHAR,
  p_search TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset INT;
  v_total INT;
BEGIN
  IF p_academic_year IS NULL OR BTRIM(p_academic_year) = '' THEN
    RETURN QUERY SELECT 400, 'academic_year is required', NULL::jsonb; RETURN;
  END IF;
  IF p_page < 1 OR p_limit < 1 THEN
    RETURN QUERY SELECT 400, 'Invalid pagination parameters', NULL::jsonb; RETURN;
  END IF;

  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total
  FROM students s
  LEFT JOIN student_fees sf
    ON sf.student_id = s.id AND sf.academic_year = BTRIM(p_academic_year)
  WHERE s.is_deleted = FALSE
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    AND (p_section_id IS NULL OR s.section_id = p_section_id)
    AND (
      p_search IS NULL OR BTRIM(p_search) = ''
      OR s.roll_number ILIKE '%' || BTRIM(p_search) || '%'
      OR BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) ILIKE '%' || BTRIM(p_search) || '%'
    );

  RETURN QUERY
  SELECT
    200,
    'Student fees fetched successfully',
    jsonb_build_object(
      'total', v_total,
      'page', p_page,
      'limit', p_limit,
      'academic_year', BTRIM(p_academic_year),
      'students', COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.danger_rank, x.due_date ASC NULLS LAST, x.paid_pct ASC NULLS LAST, x.roll_number), '[]'::jsonb)
    )
  FROM (
    SELECT
      s.id AS student_id,
      s.roll_number,
      s.first_name,
      s.last_name,
      s.class_id,
      c.name AS class_name,
      s.section_id,
      sec.section_code,
      sf.id AS fee_id,
      sf.total_fee,
      sf.discount,
      sf.net_fee,
      sf.due_date,
      COALESCE(paid.total_paid, 0) AS total_paid,
      CASE WHEN sf.id IS NOT NULL
           THEN sf.net_fee - COALESCE(paid.total_paid, 0)
           ELSE NULL END AS balance,
      COALESCE(paid.payment_count, 0) AS payment_count,
      paid.last_payment_date,
      CASE
        WHEN sf.due_date IS NOT NULL
             AND sf.due_date <= CURRENT_DATE + INTERVAL '30 days'
             AND COALESCE(paid.total_paid, 0) < sf.net_fee
        THEN 0
        ELSE 1
      END AS danger_rank,
      CASE WHEN NULLIF(sf.net_fee, 0) IS NOT NULL
           THEN COALESCE(paid.total_paid, 0) / sf.net_fee
           ELSE NULL END AS paid_pct
    FROM students s
    JOIN classes c ON c.id = s.class_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    LEFT JOIN student_fees sf
      ON sf.student_id = s.id AND sf.academic_year = BTRIM(p_academic_year)
    LEFT JOIN LATERAL (
      SELECT
        SUM(fp.amount) AS total_paid,
        COUNT(*) AS payment_count,
        MAX(fp.payment_date) AS last_payment_date
      FROM fee_payments fp
      WHERE fp.student_fee_id = sf.id
    ) paid ON sf.id IS NOT NULL
    WHERE s.is_deleted = FALSE
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_section_id IS NULL OR s.section_id = p_section_id)
      AND (
        p_search IS NULL OR BTRIM(p_search) = ''
        OR s.roll_number ILIKE '%' || BTRIM(p_search) || '%'
        OR BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) ILIKE '%' || BTRIM(p_search) || '%'
      )
    ORDER BY
      CASE
        WHEN sf.due_date IS NOT NULL
             AND sf.due_date <= CURRENT_DATE + INTERVAL '30 days'
             AND COALESCE(paid.total_paid, 0) < sf.net_fee
        THEN 0
        ELSE 1
      END,
      sf.due_date ASC NULLS LAST,
      COALESCE(paid.total_paid, 0) / NULLIF(sf.net_fee, 0) ASC NULLS LAST,
      s.roll_number
    LIMIT p_limit OFFSET v_offset
  ) x;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Paginated payment history for a single fee record.
CREATE OR REPLACE FUNCTION public.atr_get_fee_payment_history(
  p_student_fee_id UUID,
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset INT;
  v_total INT;
BEGIN
  IF p_student_fee_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_fee_id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM student_fees WHERE id = p_student_fee_id) THEN
    RETURN QUERY SELECT 404, 'Fee record not found', NULL::jsonb; RETURN;
  END IF;
  IF p_page < 1 OR p_limit < 1 THEN
    RETURN QUERY SELECT 400, 'Invalid pagination parameters', NULL::jsonb; RETURN;
  END IF;

  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total
  FROM fee_payments
  WHERE student_fee_id = p_student_fee_id;

  RETURN QUERY
  SELECT
    200,
    'Payment history fetched successfully',
    jsonb_build_object(
      'total', v_total,
      'page', p_page,
      'limit', p_limit,
      'payments', COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.payment_date DESC, x.created_at DESC), '[]'::jsonb)
    )
  FROM (
    SELECT
      fp.id,
      fp.student_fee_id,
      fp.amount,
      fp.payment_date,
      fp.payment_method,
      fp.reference_number,
      fp.receipt_number,
      fp.gateway_order_id,
      fp.gateway_payment_id,
      fp.gateway_status,
      fp.notes,
      fp.created_by,
      fp.created_at
    FROM fee_payments fp
    WHERE fp.student_fee_id = p_student_fee_id
    ORDER BY fp.payment_date DESC, fp.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) x;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Delete an incorrect manual payment.
-- Blocks deletion of gateway-originated payments (gateway_payment_id IS NOT NULL).
CREATE OR REPLACE FUNCTION public.atr_delete_fee_payment(
  p_payment_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_gateway_payment_id VARCHAR;
  v_student_fee_id UUID;
BEGIN
  IF p_payment_id IS NULL THEN
    RETURN QUERY SELECT 400, 'payment_id is required', NULL::jsonb; RETURN;
  END IF;

  SELECT gateway_payment_id, student_fee_id
  INTO v_gateway_payment_id, v_student_fee_id
  FROM fee_payments
  WHERE id = p_payment_id;

  IF v_student_fee_id IS NULL THEN
    RETURN QUERY SELECT 404, 'Payment not found', NULL::jsonb; RETURN;
  END IF;

  IF v_gateway_payment_id IS NOT NULL AND BTRIM(v_gateway_payment_id) <> '' THEN
    RETURN QUERY SELECT 403,
      'Cannot delete a payment processed through payment gateway',
      NULL::jsonb;
    RETURN;
  END IF;

  DELETE FROM fee_payments WHERE id = p_payment_id;

  RETURN QUERY SELECT 200,
    'Payment deleted successfully',
    jsonb_build_object('id', p_payment_id, 'student_fee_id', v_student_fee_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Bulk-assign fee to all active students in a class (+ optional section).
-- Default: replace amounts and replace fee items with one named item.
-- When p_add_to_existing: add total_fee and discount; append a named fee item.
-- Skips students where resulting net_fee would be below already-paid amounts.
DROP FUNCTION IF EXISTS public.atr_bulk_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, DATE, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.atr_bulk_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, DATE, UUID, TEXT, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.atr_bulk_assign_student_fee(UUID, VARCHAR, NUMERIC, NUMERIC, DATE, UUID, TEXT, UUID, BOOLEAN, VARCHAR);

CREATE OR REPLACE FUNCTION public.atr_bulk_assign_student_fee(
  p_class_id UUID,
  p_academic_year VARCHAR,
  p_total_fee NUMERIC,
  p_discount NUMERIC DEFAULT 0,
  p_due_date DATE DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_add_to_existing BOOLEAN DEFAULT FALSE,
  p_fee_name VARCHAR DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_student RECORD;
  v_assigned INT := 0;
  v_skipped INT := 0;
  v_skipped_ids UUID[] := '{}';
  v_existing_id UUID;
  v_fee_id UUID;
  v_paid NUMERIC;
  v_old_total NUMERIC;
  v_old_discount NUMERIC;
  v_new_net NUMERIC;
  v_clean_notes TEXT;
  v_clean_fee_name VARCHAR;
  v_clean_year VARCHAR;
  v_add BOOLEAN := COALESCE(p_add_to_existing, FALSE);
BEGIN
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_academic_year IS NULL OR BTRIM(p_academic_year) = '' THEN
    RETURN QUERY SELECT 400, 'academic_year is required', NULL::jsonb; RETURN;
  END IF;
  IF p_fee_name IS NULL OR BTRIM(p_fee_name) = '' THEN
    RETURN QUERY SELECT 400, 'fee_name is required', NULL::jsonb; RETURN;
  END IF;
  v_clean_fee_name := LEFT(BTRIM(p_fee_name), 120);
  IF p_total_fee IS NULL OR p_total_fee < 0 THEN
    RETURN QUERY SELECT 400, 'total_fee must be 0 or more', NULL::jsonb; RETURN;
  END IF;
  IF p_discount IS NULL OR p_discount < 0 THEN
    RETURN QUERY SELECT 400, 'discount must be 0 or more', NULL::jsonb; RETURN;
  END IF;
  IF p_discount > p_total_fee THEN
    RETURN QUERY SELECT 400, 'discount cannot exceed total_fee', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
    RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
  END IF;

  v_clean_year := BTRIM(p_academic_year);
  v_clean_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  FOR v_student IN
    SELECT s.id
    FROM students s
    WHERE s.class_id = p_class_id
      AND s.is_deleted = FALSE
      AND (p_section_id IS NULL OR s.section_id = p_section_id)
    ORDER BY s.roll_number
  LOOP
    v_existing_id := NULL;
    v_paid := 0;
    v_old_total := 0;
    v_old_discount := 0;

    SELECT sf.id, sf.total_fee, sf.discount
    INTO v_existing_id, v_old_total, v_old_discount
    FROM student_fees sf
    WHERE sf.student_id = v_student.id AND sf.academic_year = v_clean_year;

    IF v_existing_id IS NOT NULL THEN
      SELECT COALESCE(SUM(fp.amount), 0) INTO v_paid
      FROM fee_payments fp
      WHERE fp.student_fee_id = v_existing_id;

      IF v_add THEN
        v_new_net := (COALESCE(v_old_total, 0) + p_total_fee)
          - (COALESCE(v_old_discount, 0) + COALESCE(p_discount, 0));
      ELSE
        v_new_net := p_total_fee - COALESCE(p_discount, 0);
      END IF;

      IF v_paid > v_new_net THEN
        v_skipped := v_skipped + 1;
        v_skipped_ids := v_skipped_ids || v_student.id;
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO student_fees (student_id, academic_year, total_fee, discount, due_date, notes, created_by, updated_by)
    VALUES (
      v_student.id,
      v_clean_year,
      p_total_fee,
      COALESCE(p_discount, 0),
      p_due_date,
      v_clean_notes,
      p_actor_user_id,
      p_actor_user_id
    )
    ON CONFLICT (student_id, academic_year)
    DO UPDATE SET
      total_fee = CASE
        WHEN v_add THEN student_fees.total_fee + EXCLUDED.total_fee
        ELSE EXCLUDED.total_fee
      END,
      discount = CASE
        WHEN v_add THEN student_fees.discount + EXCLUDED.discount
        ELSE EXCLUDED.discount
      END,
      due_date = CASE
        WHEN v_add THEN COALESCE(EXCLUDED.due_date, student_fees.due_date)
        ELSE EXCLUDED.due_date
      END,
      notes = CASE
        WHEN v_add THEN COALESCE(EXCLUDED.notes, student_fees.notes)
        ELSE EXCLUDED.notes
      END,
      updated_by = p_actor_user_id,
      updated_at = NOW()
    RETURNING id INTO v_fee_id;

    IF NOT v_add THEN
      DELETE FROM student_fee_items WHERE student_fee_id = v_fee_id;
    END IF;

    INSERT INTO student_fee_items (student_fee_id, fee_name, amount, discount, notes, created_by)
    VALUES (
      v_fee_id,
      v_clean_fee_name,
      p_total_fee,
      COALESCE(p_discount, 0),
      v_clean_notes,
      p_actor_user_id
    );

    v_assigned := v_assigned + 1;
  END LOOP;

  IF v_assigned = 0 AND v_skipped = 0 THEN
    RETURN QUERY SELECT 404,
      'No active students found for this class/section',
      NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY SELECT 200,
    'Bulk fee assignment completed',
    jsonb_build_object(
      'assigned', v_assigned,
      'skipped', v_skipped,
      'skipped_ids', to_jsonb(v_skipped_ids)
    );
EXCEPTION
  WHEN check_violation THEN
    RETURN QUERY SELECT 400, 'Invalid fee values: ' || SQLERRM, NULL::jsonb;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


-- Dashboard summary: totals for fee collection across all students.
-- Optionally filtered by academic_year, class, section.
CREATE OR REPLACE FUNCTION public.atr_get_fee_dashboard_summary(
  p_academic_year VARCHAR DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_students INT;
  v_students_with_fee INT;
  v_total_expected NUMERIC;
  v_total_collected NUMERIC;
  v_total_outstanding NUMERIC;
  v_collection_rate NUMERIC;
  v_fully_paid INT;
  v_partially_paid INT;
  v_unpaid INT;
  v_recent_payments JSONB;
BEGIN
  -- Counts scoped to filters
  WITH scoped_fees AS (
    SELECT sf.id, sf.student_id, sf.net_fee
    FROM student_fees sf
    JOIN students s ON s.id = sf.student_id AND s.is_deleted = FALSE
    WHERE (p_academic_year IS NULL OR sf.academic_year = BTRIM(p_academic_year))
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_section_id IS NULL OR s.section_id = p_section_id)
  ),
  fee_with_paid AS (
    SELECT
      sf.id,
      sf.net_fee,
      COALESCE(SUM(fp.amount), 0) AS paid
    FROM scoped_fees sf
    LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
    GROUP BY sf.id, sf.net_fee
  )
  SELECT
    COUNT(*),
    COALESCE(SUM(net_fee), 0),
    COALESCE(SUM(paid), 0),
    COALESCE(SUM(net_fee - paid), 0),
    COUNT(*) FILTER (WHERE paid >= net_fee AND net_fee > 0),
    COUNT(*) FILTER (WHERE paid > 0 AND paid < net_fee),
    COUNT(*) FILTER (WHERE paid = 0 AND net_fee > 0)
  INTO
    v_students_with_fee,
    v_total_expected,
    v_total_collected,
    v_total_outstanding,
    v_fully_paid,
    v_partially_paid,
    v_unpaid
  FROM fee_with_paid;

  SELECT COUNT(*) INTO v_total_students
  FROM students s
  WHERE s.is_deleted = FALSE
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    AND (p_section_id IS NULL OR s.section_id = p_section_id);

  v_collection_rate :=
    CASE
      WHEN COALESCE(v_total_expected, 0) <= 0 THEN 0
      ELSE ROUND((v_total_collected / v_total_expected) * 100, 2)
    END;

  -- Recent 10 payments
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.payment_date DESC, x.created_at DESC), '[]'::jsonb)
  INTO v_recent_payments
  FROM (
    SELECT
      fp.id,
      fp.amount,
      fp.payment_date,
      fp.payment_method,
      fp.receipt_number,
      s.roll_number,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      c.name AS class_name,
      fp.created_at
    FROM fee_payments fp
    JOIN student_fees sf ON sf.id = fp.student_fee_id
    JOIN students s ON s.id = sf.student_id AND s.is_deleted = FALSE
    JOIN classes c ON c.id = s.class_id
    WHERE (p_academic_year IS NULL OR sf.academic_year = BTRIM(p_academic_year))
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_section_id IS NULL OR s.section_id = p_section_id)
    ORDER BY fp.payment_date DESC, fp.created_at DESC
    LIMIT 10
  ) x;

  RETURN QUERY SELECT 200,
    'Fee dashboard summary fetched successfully',
    jsonb_build_object(
      'total_students', COALESCE(v_total_students, 0),
      'students_with_fee', COALESCE(v_students_with_fee, 0),
      'total_expected', COALESCE(v_total_expected, 0),
      'total_collected', COALESCE(v_total_collected, 0),
      'total_outstanding', COALESCE(v_total_outstanding, 0),
      'collection_rate', COALESCE(v_collection_rate, 0),
      'fully_paid', COALESCE(v_fully_paid, 0),
      'partially_paid', COALESCE(v_partially_paid, 0),
      'unpaid', COALESCE(v_unpaid, 0),
      'recent_payments', COALESCE(v_recent_payments, '[]'::jsonb)
    );
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;

-- Delete a named fee line item and subtract its amount/discount from the parent fee totals.
DROP FUNCTION IF EXISTS public.atr_delete_student_fee_item(UUID);

CREATE OR REPLACE FUNCTION public.atr_delete_student_fee_item(
  p_item_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_fee_id UUID;
  v_fee_name VARCHAR;
  v_amount NUMERIC;
  v_discount NUMERIC;
  v_total NUMERIC;
  v_fee_discount NUMERIC;
  v_paid NUMERIC;
  v_new_total NUMERIC;
  v_new_discount NUMERIC;
  v_new_net NUMERIC;
BEGIN
  IF p_item_id IS NULL THEN
    RETURN QUERY SELECT 400, 'fee_item_id is required', NULL::jsonb; RETURN;
  END IF;

  SELECT fi.student_fee_id, fi.fee_name, fi.amount, fi.discount
  INTO v_student_fee_id, v_fee_name, v_amount, v_discount
  FROM student_fee_items fi
  WHERE fi.id = p_item_id;

  IF v_student_fee_id IS NULL THEN
    RETURN QUERY SELECT 404, 'Fee type not found', NULL::jsonb; RETURN;
  END IF;

  SELECT sf.total_fee, sf.discount
  INTO v_total, v_fee_discount
  FROM student_fees sf
  WHERE sf.id = v_student_fee_id
  FOR UPDATE;

  IF v_total IS NULL THEN
    RETURN QUERY SELECT 404, 'Fee record not found', NULL::jsonb; RETURN;
  END IF;

  SELECT COALESCE(SUM(fp.amount), 0) INTO v_paid
  FROM fee_payments fp
  WHERE fp.student_fee_id = v_student_fee_id;

  v_new_total := GREATEST(0, COALESCE(v_total, 0) - COALESCE(v_amount, 0));
  v_new_discount := GREATEST(0, COALESCE(v_fee_discount, 0) - COALESCE(v_discount, 0));
  IF v_new_discount > v_new_total THEN
    v_new_discount := v_new_total;
  END IF;
  v_new_net := v_new_total - v_new_discount;

  IF v_paid > v_new_net THEN
    RETURN QUERY SELECT 400,
      'Cannot delete this fee type because payments (' || v_paid::text || ') would exceed the remaining net fee (' || v_new_net::text || ')',
      NULL::jsonb;
    RETURN;
  END IF;

  UPDATE student_fees
  SET
    total_fee = v_new_total,
    discount = v_new_discount,
    updated_at = NOW()
  WHERE id = v_student_fee_id;

  DELETE FROM student_fee_items WHERE id = p_item_id;

  RETURN QUERY SELECT 200,
    'Fee type deleted successfully',
    jsonb_build_object(
      'id', p_item_id,
      'student_fee_id', v_student_fee_id,
      'fee_name', v_fee_name,
      'total_fee', v_new_total,
      'discount', v_new_discount,
      'net_fee', v_new_net
    );
EXCEPTION
  WHEN check_violation THEN
    RETURN QUERY SELECT 400, 'Invalid fee values: ' || SQLERRM, NULL::jsonb;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;
