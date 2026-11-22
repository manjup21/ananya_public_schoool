-- ============================================================
-- SUBJECTS FUNCTIONS
-- Synced from database: 2026-04-10T11:30:12.638Z
-- ============================================================
DROP FUNCTION IF EXISTS public.get_subjects(text);

CREATE OR REPLACE FUNCTION public.create_subject(p_name character varying, p_created_by uuid, p_code character varying DEFAULT NULL::character varying, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id UUID;
    v_name_display TEXT;
    v_name_key TEXT;
    v_code TEXT;
BEGIN
    -- Validation
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Subject name is required';
    END IF;

    -- Keep the original casing for storage/display, but compare case-insensitively.
    v_name_display := REGEXP_REPLACE(BTRIM(p_name), '\s+', ' ', 'g');
    v_name_key := LOWER(v_name_display);
    v_code := NULLIF(REGEXP_REPLACE(BTRIM(COALESCE(p_code, '')), '\s+', ' ', 'g'), '');

    -- Duplicate check (case-insensitive, ignores deleted)
    IF EXISTS (
        SELECT 1 FROM subjects
        WHERE is_deleted = FALSE
          AND LOWER(name) = v_name_key
    ) THEN
        RAISE EXCEPTION 'Subject already exists';
    END IF;

    IF v_code IS NOT NULL AND EXISTS (
        SELECT 1 FROM subjects
        WHERE is_deleted = FALSE
          AND code IS NOT NULL
          AND LOWER(code) = LOWER(v_code)
    ) THEN
        RAISE EXCEPTION 'Subject code already exists';
    END IF;

    -- Insert (append at end of catalog order)
    INSERT INTO subjects (
        id,
        name,
        code,
        description,
        sort_order,
        created_by
    )
    VALUES (
        gen_random_uuid(),
        v_name_display,
        v_code,
        p_description,
        COALESCE((SELECT MAX(sort_order) FROM subjects WHERE is_deleted = FALSE), 0) + 1,
        p_created_by
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_subject(p_id uuid, p_name character varying, p_code character varying, p_description text, p_is_active boolean, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_name_display TEXT;
    v_name_key TEXT;
    v_code TEXT;
BEGIN
    -- Validation
    IF NOT EXISTS (
        SELECT 1 FROM subjects WHERE id = p_id AND is_deleted = FALSE
    ) THEN
        RAISE EXCEPTION 'Subject not found';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Subject name is required';
    END IF;

    v_name_display := REGEXP_REPLACE(BTRIM(p_name), '\s+', ' ', 'g');
    v_name_key := LOWER(v_name_display);
    v_code := NULLIF(REGEXP_REPLACE(BTRIM(COALESCE(p_code, '')), '\s+', ' ', 'g'), '');

    IF EXISTS (
        SELECT 1 FROM subjects
        WHERE is_deleted = FALSE
          AND id <> p_id
          AND LOWER(name) = v_name_key
    ) THEN
        RAISE EXCEPTION 'Subject already exists';
    END IF;

    IF v_code IS NOT NULL AND EXISTS (
        SELECT 1 FROM subjects
        WHERE is_deleted = FALSE
          AND id <> p_id
          AND code IS NOT NULL
          AND LOWER(code) = LOWER(v_code)
    ) THEN
        RAISE EXCEPTION 'Subject code already exists';
    END IF;

    UPDATE subjects
    SET
        name = v_name_display,
        code = v_code,
        description = p_description,
        is_active = COALESCE(p_is_active, is_active),
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_subject(p_id uuid, p_deleted_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM subjects WHERE id = p_id AND is_deleted = FALSE
    ) THEN
        RAISE EXCEPTION 'Subject not found or already deleted';
    END IF;

    UPDATE subjects
    SET
        is_deleted = TRUE,
        deleted_by = p_deleted_by,
        deleted_at = NOW()
    WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_subject(p_id uuid, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM subjects WHERE id = p_id AND is_deleted = TRUE
    ) THEN
        RAISE EXCEPTION 'Subject not found or not deleted';
    END IF;

    UPDATE subjects
    SET
        is_deleted = FALSE,
        deleted_at = NULL,
        deleted_by = NULL,
        sort_order = COALESCE((SELECT MAX(sort_order) FROM subjects WHERE is_deleted = FALSE), 0) + 1,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_subject_status(p_id uuid, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE subjects
    SET
        is_active = NOT is_active,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = p_id AND is_deleted = FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_subjects(p_search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name character varying, code character varying, is_active boolean, sort_order integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.code,
        s.is_active,
        s.sort_order,
        s.created_at
    FROM subjects s
    WHERE 
        s.is_deleted = FALSE
        AND (
            p_search IS NULL OR
            LOWER(s.name) LIKE LOWER('%' || p_search || '%') OR
            (s.code IS NOT NULL AND LOWER(s.code) LIKE LOWER('%' || p_search || '%'))
        )
    ORDER BY s.sort_order ASC, s.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reorder_subjects(p_ordered_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_expected INT;
  v_provided INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_expected FROM subjects WHERE is_deleted = FALSE;

  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'ordered_ids must include every active subject exactly once';
  END IF;

  v_provided := array_length(p_ordered_ids, 1);
  IF v_provided <> v_expected THEN
    RAISE EXCEPTION 'ordered_ids must include every active subject exactly once';
  END IF;

  IF v_provided <> (SELECT COUNT(DISTINCT u.id)::INT FROM unnest(p_ordered_ids) AS u(id)) THEN
    RAISE EXCEPTION 'ordered_ids must not contain duplicates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) AS u(id)
    WHERE NOT EXISTS (SELECT 1 FROM subjects s WHERE s.id = u.id AND s.is_deleted = FALSE)
  ) THEN
    RAISE EXCEPTION 'ordered_ids contains invalid or deleted subject id';
  END IF;

  UPDATE subjects s
  SET sort_order = u.pos, updated_at = NOW()
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, pos)
  WHERE s.id = u.id AND s.is_deleted = FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_subject_by_id(p_id uuid)
 RETURNS subjects
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_subject subjects;
BEGIN
    SELECT * INTO v_subject
    FROM subjects
    WHERE id = p_id AND is_deleted = FALSE;

    IF v_subject IS NULL THEN
        RAISE EXCEPTION 'Subject not found';
    END IF;

    RETURN v_subject;
END;
$function$;
