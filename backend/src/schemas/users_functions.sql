-- ============================================================
-- USERS FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.atr_create_user(p_name character varying, p_email character varying, p_password_hash text, p_role character varying)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user RECORD;
BEGIN
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RETURN QUERY SELECT 400, 'Name is required', NULL;
        RETURN;
    END IF;

    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RETURN QUERY SELECT 400, 'Email is required', NULL;
        RETURN;
    END IF;

    IF p_password_hash IS NULL OR TRIM(p_password_hash) = '' THEN
        RETURN QUERY SELECT 400, 'Password is required', NULL;
        RETURN;
    END IF;

    IF p_role NOT IN ('admin', 'lecturer') THEN
        RETURN QUERY SELECT 400, 'Invalid role', NULL;
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        RETURN QUERY SELECT 409, 'Email already exists', NULL;
        RETURN;
    END IF;

    INSERT INTO users (name, email, password_hash, role, can_manage_fees, is_super_admin, is_admin)
    VALUES (p_name, p_email, p_password_hash, p_role, FALSE, FALSE, FALSE)
    RETURNING * INTO v_user;

    RETURN QUERY SELECT
        201,
        'User created successfully',
        jsonb_build_object(
            'id', v_user.id,
            'name', v_user.name,
            'email', v_user.email,
            'role', v_user.role,
            'can_manage_fees', COALESCE(v_user.can_manage_fees, FALSE),
            'is_super_admin', COALESCE(v_user.is_super_admin, FALSE),
            'is_admin', COALESCE(v_user.is_admin, FALSE)
        );

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

DROP FUNCTION IF EXISTS public.atr_update_user(uuid, character varying, character varying, text, character varying, boolean);

CREATE OR REPLACE FUNCTION public.atr_update_user(
  p_user_id uuid,
  p_name character varying DEFAULT NULL::character varying,
  p_email character varying DEFAULT NULL::character varying,
  p_password_hash text DEFAULT NULL::text,
  p_role character varying DEFAULT NULL::character varying,
  p_can_manage_fees boolean DEFAULT NULL::boolean,
  p_is_super_admin boolean DEFAULT NULL::boolean,
  p_is_admin boolean DEFAULT NULL::boolean
)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RETURN QUERY SELECT 404, 'User not found', NULL;
        RETURN;
    END IF;

    IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'lecturer') THEN
        RETURN QUERY SELECT 400, 'Invalid role', NULL;
        RETURN;
    END IF;

    IF p_email IS NOT NULL AND EXISTS (
        SELECT 1 FROM users WHERE email = p_email AND id <> p_user_id
    ) THEN
        RETURN QUERY SELECT 409, 'Email already in use', NULL;
        RETURN;
    END IF;

    UPDATE users
    SET
        name = COALESCE(p_name, name),
        email = COALESCE(p_email, email),
        password_hash = COALESCE(p_password_hash, password_hash),
        role = COALESCE(p_role, role),
        can_manage_fees = COALESCE(p_can_manage_fees, can_manage_fees),
        is_super_admin = COALESCE(p_is_super_admin, is_super_admin),
        is_admin = COALESCE(p_is_admin, is_admin)
    WHERE id = p_user_id
    RETURNING * INTO v_user;

    RETURN QUERY SELECT
        200,
        'User updated successfully',
        jsonb_build_object(
            'id', v_user.id,
            'name', v_user.name,
            'email', v_user.email,
            'role', v_user.role,
            'can_manage_fees', COALESCE(v_user.can_manage_fees, FALSE),
            'is_super_admin', COALESCE(v_user.is_super_admin, FALSE),
            'is_admin', COALESCE(v_user.is_admin, FALSE)
        );

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_delete_user(p_user_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RETURN QUERY SELECT 404, 'User not found', NULL;
        RETURN;
    END IF;

    DELETE FROM users WHERE id = p_user_id;

    RETURN QUERY SELECT
        200,
        'User deleted successfully',
        NULL;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_users(p_page integer DEFAULT 1, p_limit integer DEFAULT 10, p_search text DEFAULT NULL::text)
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
    FROM users
    WHERE
        p_search IS NULL
        OR name ILIKE '%' || p_search || '%'
        OR email ILIKE '%' || p_search || '%';

    RETURN QUERY
    SELECT
        200,
        'Users fetched successfully',
        jsonb_build_object(
            'total', v_total,
            'page', p_page,
            'limit', p_limit,
            'users', (
                SELECT jsonb_agg(row_to_json(u))
                FROM (
                    SELECT id, name, email, role, can_manage_fees, is_super_admin, is_admin, created_at
                    FROM users
                    WHERE
                        p_search IS NULL
                        OR name ILIKE '%' || p_search || '%'
                        OR email ILIKE '%' || p_search || '%'
                    ORDER BY created_at DESC
                    LIMIT p_limit OFFSET v_offset
                ) u
            )
        );

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_user_by_id(p_user_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT 400, 'User id is required', NULL::jsonb;
    RETURN;
  END IF;

  SELECT id, name, email, role, can_manage_fees, is_super_admin, is_admin
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'User not found', NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'User fetched successfully'::text,
    jsonb_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'email', v_user.email,
      'role', v_user.role,
      'can_manage_fees', COALESCE(v_user.can_manage_fees, FALSE),
      'is_super_admin', COALESCE(v_user.is_super_admin, FALSE),
      'is_admin', COALESCE(v_user.is_admin, FALSE)
    );

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_user_auth_by_email(p_email character varying)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user RECORD;
  v_key TEXT;
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN QUERY SELECT 400, 'Email is required', NULL::jsonb;
    RETURN;
  END IF;

  v_key := LOWER(BTRIM(p_email));

  SELECT id, name, email, role, can_manage_fees, is_super_admin, is_admin, password_hash
  INTO v_user
  FROM users
  WHERE LOWER(email) = v_key;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'User not found', NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'User fetched successfully',
    jsonb_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'email', v_user.email,
      'role', v_user.role,
      'can_manage_fees', COALESCE(v_user.can_manage_fees, FALSE),
      'is_super_admin', COALESCE(v_user.is_super_admin, FALSE),
      'is_admin', COALESCE(v_user.is_admin, FALSE),
      'password_hash', v_user.password_hash
    );

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_user_auth_by_lecturer_employee_id(p_employee_id character varying)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user RECORD;
  v_key TEXT;
BEGIN
  IF p_employee_id IS NULL OR BTRIM(p_employee_id) = '' THEN
    RETURN QUERY SELECT 400, 'Employee ID is required', NULL::jsonb;
    RETURN;
  END IF;

  v_key := UPPER(BTRIM(p_employee_id));

  SELECT u.id, u.name, u.email, u.role, u.can_manage_fees, u.is_super_admin, u.is_admin, u.password_hash
  INTO v_user
  FROM lecturers l
  INNER JOIN users u ON u.id = l.user_id
  WHERE UPPER(l.employee_id) = v_key;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'User not found', NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'User fetched successfully',
    jsonb_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'email', v_user.email,
      'role', v_user.role,
      'can_manage_fees', COALESCE(v_user.can_manage_fees, FALSE),
      'is_super_admin', COALESCE(v_user.is_super_admin, FALSE),
      'is_admin', COALESCE(v_user.is_admin, FALSE),
      'password_hash', v_user.password_hash
    );

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;
