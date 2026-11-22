-- ============================================================
-- EXAM TYPES — list / create / update / delete
-- Default "Others" row has is_system = TRUE (non-editable, non-deletable).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_exam_types(text);

CREATE OR REPLACE FUNCTION public.get_exam_types(p_search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name character varying, is_system boolean, sort_order integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.is_system,
    t.sort_order,
    t.created_at
  FROM exam_types t
  WHERE
    p_search IS NULL
    OR LOWER(t.name) LIKE LOWER('%' || TRIM(p_search) || '%')
  ORDER BY (CASE WHEN t.is_system THEN 1 ELSE 0 END), t.sort_order ASC, t.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_exam_type(p_name character varying, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF p_name IS NULL OR BTRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Exam type name is required';
  END IF;

  INSERT INTO exam_types (id, name, is_system, sort_order, created_by)
  VALUES (
    uuid_generate_v4(),
    BTRIM(p_name),
    FALSE,
    COALESCE((SELECT MAX(sort_order) FROM exam_types WHERE is_system = FALSE), 0) + 1,
    p_created_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'An exam type with this name already exists';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_exam_type(p_id uuid, p_name character varying, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sys BOOLEAN;
BEGIN
  IF p_name IS NULL OR BTRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Exam type name is required';
  END IF;

  SELECT is_system INTO v_sys FROM exam_types WHERE id = p_id;
  IF v_sys IS NULL THEN
    RAISE EXCEPTION 'Exam type not found';
  END IF;
  IF v_sys = TRUE THEN
    RAISE EXCEPTION 'Cannot modify system exam type';
  END IF;

  UPDATE exam_types
  SET
    name = BTRIM(p_name),
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'An exam type with this name already exists';
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_exam_type(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sys BOOLEAN;
BEGIN
  SELECT is_system INTO v_sys FROM exam_types WHERE id = p_id;
  IF v_sys IS NULL THEN
    RAISE EXCEPTION 'Exam type not found';
  END IF;
  IF v_sys = TRUE THEN
    RAISE EXCEPTION 'Cannot delete system exam type';
  END IF;
  IF EXISTS (SELECT 1 FROM examinations WHERE exam_type_id = p_id) THEN
    RAISE EXCEPTION 'Exam type is in use and cannot be deleted';
  END IF;

  DELETE FROM exam_types WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reorder_exam_types(p_ordered_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_expected INT;
  v_provided INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_expected FROM exam_types WHERE is_system = FALSE;

  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'ordered_ids must include every non-system exam type exactly once';
  END IF;

  v_provided := array_length(p_ordered_ids, 1);
  IF v_provided <> v_expected THEN
    RAISE EXCEPTION 'ordered_ids must include every non-system exam type exactly once';
  END IF;

  IF v_provided <> (SELECT COUNT(DISTINCT u.id)::INT FROM unnest(p_ordered_ids) AS u(id)) THEN
    RAISE EXCEPTION 'ordered_ids must not contain duplicates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) AS u(id)
    JOIN exam_types t ON t.id = u.id
    WHERE t.is_system = TRUE
  ) THEN
    RAISE EXCEPTION 'Cannot reorder system exam type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) AS u(id)
    WHERE NOT EXISTS (SELECT 1 FROM exam_types t WHERE t.id = u.id AND t.is_system = FALSE)
  ) THEN
    RAISE EXCEPTION 'ordered_ids contains invalid exam type id';
  END IF;

  UPDATE exam_types t
  SET sort_order = u.pos, updated_at = NOW()
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, pos)
  WHERE t.id = u.id AND t.is_system = FALSE;
END;
$function$;
