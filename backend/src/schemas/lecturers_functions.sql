-- ============================================================
-- LECTURERS FUNCTIONS
-- Synced from database: 2026-04-10T11:30:12.628Z
-- ============================================================
CREATE OR REPLACE FUNCTION public.atr_create_lecturer(p_title character varying, p_first_name character varying, p_last_name character varying, p_employee_id character varying, p_email character varying, p_phone character varying, p_dob date, p_subjects text, p_password_hash text)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user_id UUID;
    v_lecturer RECORD;
BEGIN
    -- VALIDATIONS
    IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
        RETURN QUERY SELECT 400, 'First name is required', NULL::jsonb; RETURN;
    END IF;

    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RETURN QUERY SELECT 400, 'Email is required', NULL::jsonb; RETURN;
    END IF;

    IF p_password_hash IS NULL OR TRIM(p_password_hash) = '' THEN
        RETURN QUERY SELECT 400, 'Password is required', NULL::jsonb; RETURN;
    END IF;

    IF p_employee_id IS NULL OR TRIM(p_employee_id) = '' THEN
        RETURN QUERY SELECT 400, 'Employee ID is required', NULL::jsonb; RETURN;
    END IF;

    -- LOCK TABLES (avoid race conditions)
    PERFORM 1 FROM users WHERE email = p_email FOR UPDATE;
    PERFORM 1 FROM lecturers WHERE employee_id = p_employee_id FOR UPDATE;

    -- DUPLICATE CHECKS
    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        RETURN QUERY SELECT 409, 'Email already exists', NULL::jsonb; RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM lecturers WHERE employee_id = p_employee_id) THEN
        RETURN QUERY SELECT 409, 'Employee ID already exists', NULL::jsonb; RETURN;
    END IF;

    -- CREATE USER
    INSERT INTO users (name, email, password_hash, role)
    VALUES (
        BTRIM(CONCAT_WS(' ', p_first_name, p_last_name)),
        p_email,
        p_password_hash,
        'lecturer'
    )
    RETURNING id INTO v_user_id;

    -- CREATE LECTURER
    INSERT INTO lecturers (
        user_id, title, first_name, last_name,
        employee_id, email, phone, date_of_birth, subjects
    )
    VALUES (
        v_user_id, p_title, p_first_name, p_last_name,
        p_employee_id, p_email, p_phone, p_dob, p_subjects
    )
    RETURNING * INTO v_lecturer;

    RETURN QUERY SELECT 
        201,
        'Lecturer created successfully',
        jsonb_build_object(
            'lecturer_id', v_lecturer.id,
            'user_id', v_user_id,
            'name', BTRIM(CONCAT_WS(' ', v_lecturer.first_name, v_lecturer.last_name)),
            'email', v_lecturer.email
        );

EXCEPTION
    WHEN OTHERS THEN
        -- automatic rollback
        RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_update_lecturer(p_lecturer_id uuid, p_title character varying DEFAULT NULL::character varying, p_first_name character varying DEFAULT NULL::character varying, p_last_name character varying DEFAULT NULL::character varying, p_employee_id character varying DEFAULT NULL::character varying, p_email character varying DEFAULT NULL::character varying, p_phone character varying DEFAULT NULL::character varying, p_dob date DEFAULT NULL::date, p_subjects text DEFAULT NULL::text)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user_id UUID;
    v_lecturer RECORD;
BEGIN
    -- LOCK ROW
    SELECT user_id INTO v_user_id 
    FROM lecturers 
    WHERE id = p_lecturer_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT 404, 'Lecturer not found', NULL::jsonb; RETURN;
    END IF;

    -- EMAIL DUPLICATE CHECK
    IF p_email IS NOT NULL AND EXISTS (
        SELECT 1 FROM users WHERE email = p_email AND id <> v_user_id
    ) THEN
        RETURN QUERY SELECT 409, 'Email already in use', NULL::jsonb; RETURN;
    END IF;

    -- UPDATE USERS
    UPDATE users
    SET 
        name = COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', p_first_name, p_last_name)), ''), name),
        email = COALESCE(p_email, email)
    WHERE id = v_user_id;

    -- UPDATE LECTURER
    UPDATE lecturers
    SET 
        title = COALESCE(p_title, title),
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        employee_id = COALESCE(p_employee_id, employee_id),
        email = COALESCE(p_email, email),
        phone = COALESCE(p_phone, phone),
        date_of_birth = COALESCE(p_dob, date_of_birth),
        subjects = COALESCE(p_subjects, subjects)
    WHERE id = p_lecturer_id
    RETURNING * INTO v_lecturer;

    RETURN QUERY SELECT 
        200,
        'Lecturer updated successfully',
        jsonb_build_object(
            'lecturer_id', v_lecturer.id,
            'name', BTRIM(CONCAT_WS(' ', v_lecturer.first_name, v_lecturer.last_name)),
            'email', v_lecturer.email
        );

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_delete_lecturer(p_lecturer_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    -- LOCK ROW
    SELECT user_id INTO v_user_id
    FROM lecturers
    WHERE id = p_lecturer_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT 404, 'Lecturer not found', NULL::jsonb; RETURN;
    END IF;

    -- DELETE LECTURER FIRST (FK safe)
    DELETE FROM lecturers WHERE id = p_lecturer_id;

    -- DELETE USER
    DELETE FROM users WHERE id = v_user_id;

    RETURN QUERY SELECT 
        200,
        'Lecturer and user deleted successfully',
        NULL::jsonb;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_lecturers(p_page integer DEFAULT 1, p_limit integer DEFAULT 10, p_search text DEFAULT NULL::text)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset INT;
  v_total INT;
BEGIN
  IF p_page < 1 OR p_limit < 1 THEN
    RETURN QUERY SELECT 400, 'Invalid pagination parameters', NULL;
    RETURN;
  END IF;

  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total
  FROM lecturers l
  WHERE
    p_search IS NULL
    OR l.first_name ILIKE '%' || p_search || '%'
    OR l.last_name ILIKE '%' || p_search || '%'
    OR l.email ILIKE '%' || p_search || '%'
    OR l.employee_id ILIKE '%' || p_search || '%';

  RETURN QUERY
  SELECT
    200,
    'Lecturers fetched successfully',
    jsonb_build_object(
      'total', v_total,
      'page', p_page,
      'limit', p_limit,
      'lecturers', (
        SELECT jsonb_agg(row_to_json(x))
        FROM (
          SELECT
            l.id,
            l.user_id,
            l.title,
            l.first_name,
            l.last_name,
            l.employee_id,
            l.email,
            l.phone,
            l.date_of_birth,
            l.subjects,
            l.created_at,
            COALESCE(u.is_admin, FALSE) OR (u.role = 'admin') AS is_admin,
            COALESCE(u.is_super_admin, FALSE) OR (u.role = 'admin') AS is_super_admin,
            COALESCE(u.can_manage_fees, FALSE) AS can_manage_fees
          FROM lecturers l
          INNER JOIN users u ON u.id = l.user_id
          WHERE
            p_search IS NULL
            OR l.first_name ILIKE '%' || p_search || '%'
            OR l.last_name ILIKE '%' || p_search || '%'
            OR l.email ILIKE '%' || p_search || '%'
            OR l.employee_id ILIKE '%' || p_search || '%'
          ORDER BY l.created_at DESC
          LIMIT p_limit OFFSET v_offset
        ) x
      )
    );

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_lecturer_by_id(p_lecturer_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_lecturer RECORD;
BEGIN
  IF p_lecturer_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Lecturer id is required', NULL;
    RETURN;
  END IF;

  SELECT
    l.id,
    l.user_id,
    l.title,
    l.first_name,
    l.last_name,
    l.employee_id,
    l.email,
    l.phone,
    l.date_of_birth,
    l.subjects,
    l.created_at,
    COALESCE(u.is_admin, FALSE) OR (u.role = 'admin') AS is_admin,
    COALESCE(u.is_super_admin, FALSE) OR (u.role = 'admin') AS is_super_admin,
    COALESCE(u.can_manage_fees, FALSE) AS can_manage_fees
  INTO v_lecturer
  FROM lecturers l
  INNER JOIN users u ON u.id = l.user_id
  WHERE l.id = p_lecturer_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'Lecturer not found', NULL;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Lecturer fetched successfully',
    to_jsonb(v_lecturer);

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_lecturer_by_user_id(p_user_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_lecturer RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT 400, 'User id is required', NULL;
    RETURN;
  END IF;

  SELECT
    id,
    user_id,
    title,
    first_name,
    last_name,
    employee_id,
    email,
    phone,
    date_of_birth,
    subjects,
    created_at
  INTO v_lecturer
  FROM lecturers
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'Lecturer profile not found for this account', NULL;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Lecturer fetched successfully',
    to_jsonb(v_lecturer);

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;
