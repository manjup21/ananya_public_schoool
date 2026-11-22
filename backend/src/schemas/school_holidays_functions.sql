-- ============================================================
-- SCHOOL HOLIDAYS (institution-wide, inclusive date ranges)
-- ============================================================

CREATE OR REPLACE FUNCTION public.atr_is_institution_holiday(p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_holidays h
    WHERE h.is_active = TRUE
      AND p_date BETWEEN h.start_date AND h.end_date
  );
$$;


-- Comma-separated names of all active holidays covering p_date (for UI messages).
CREATE OR REPLACE FUNCTION public.atr_get_institution_holiday_names(p_date DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT string_agg(h.name, ', ' ORDER BY h.start_date, h.name)
  FROM public.school_holidays h
  WHERE h.is_active = TRUE
    AND p_date BETWEEN h.start_date AND h.end_date;
$$;


CREATE OR REPLACE FUNCTION public.atr_list_school_holidays(
  p_search TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    200,
    'School holidays fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.start_date, x.name), '[]'::jsonb)
  FROM (
    SELECT
      h.id,
      h.name,
      h.start_date,
      h.end_date,
      h.is_active,
      h.created_by,
      h.updated_by,
      h.created_at,
      h.updated_at
    FROM public.school_holidays h
    WHERE
      (p_search IS NULL OR BTRIM(p_search) = '' OR LOWER(h.name) LIKE '%' || LOWER(BTRIM(p_search)) || '%')
      AND (p_is_active IS NULL OR h.is_active = p_is_active)
      AND (
        p_from IS NULL
        OR p_to IS NULL
        OR NOT (h.end_date < p_from OR h.start_date > p_to)
      )
  ) x;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_create_school_holiday(
  p_name VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_name IS NULL OR BTRIM(p_name) = '' THEN
    RETURN QUERY SELECT 400, 'Holiday name is required', NULL::jsonb; RETURN;
  END IF;
  IF LENGTH(BTRIM(p_name)) > 150 THEN
    RETURN QUERY SELECT 400, 'Holiday name must be at most 150 characters', NULL::jsonb; RETURN;
  END IF;
  IF p_start_date IS NULL THEN
    RETURN QUERY SELECT 400, 'Start date is required', NULL::jsonb; RETURN;
  END IF;
  -- Single-day holiday: pass end_date equal to start_date, or omit end_date (NULL → same as start).
  IF COALESCE(p_end_date, p_start_date) < p_start_date THEN
    RETURN QUERY SELECT 400, 'End date must be on or after start date', NULL::jsonb; RETURN;
  END IF;

  INSERT INTO public.school_holidays (id, name, start_date, end_date, is_active, created_by, updated_by)
  VALUES (
    uuid_generate_v4(),
    BTRIM(p_name),
    p_start_date,
    COALESCE(p_end_date, p_start_date),
    TRUE,
    p_created_by,
    p_created_by
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 201, 'School holiday created successfully', jsonb_build_object('id', v_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_update_school_holiday(
  p_id UUID,
  p_name VARCHAR DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  IF p_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Holiday id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_holidays WHERE id = p_id) THEN
    RETURN QUERY SELECT 404, 'School holiday not found', NULL::jsonb; RETURN;
  END IF;

  SELECT start_date, end_date INTO v_start, v_end FROM public.school_holidays WHERE id = p_id;
  IF p_start_date IS NOT NULL THEN v_start := p_start_date; END IF;
  IF p_end_date IS NOT NULL THEN v_end := p_end_date; END IF;

  IF v_end < v_start THEN
    RETURN QUERY SELECT 400, 'End date must be on or after start date', NULL::jsonb; RETURN;
  END IF;

  IF p_name IS NOT NULL AND (BTRIM(p_name) = '' OR LENGTH(BTRIM(p_name)) > 150) THEN
    RETURN QUERY SELECT 400, 'Holiday name must be 1–150 characters', NULL::jsonb; RETURN;
  END IF;

  UPDATE public.school_holidays
  SET
    name = COALESCE(NULLIF(BTRIM(p_name), ''), name),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    is_active = COALESCE(p_is_active, is_active),
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_id;

  RETURN QUERY SELECT 200, 'School holiday updated successfully', jsonb_build_object('id', p_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_delete_school_holiday(p_id UUID)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Holiday id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_holidays WHERE id = p_id) THEN
    RETURN QUERY SELECT 404, 'School holiday not found', NULL::jsonb; RETURN;
  END IF;

  DELETE FROM public.school_holidays WHERE id = p_id;
  RETURN QUERY SELECT 200, 'School holiday deleted successfully', jsonb_build_object('id', p_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;
