-- ============================================================
-- EXAMINATIONS FUNCTIONS
-- examination_subjects stores per-subject max_marks / passing_marks
-- and per-subject exam_date / start_time / end_time.
-- examinations.exam_date / start_time / end_time = earliest subject sitting
-- (ORDER BY exam_date ASC, start_time ASC NULLS LAST).
-- Optional parallel arrays p_subject_max_marks / p_subject_passing_marks
-- and p_subject_exam_dates / p_subject_start_times / p_subject_end_times
-- (same order as p_subject_ids). If subject date arrays omitted, body
-- p_exam_date is replicated per subject (backward compat).
-- Optional p_part_b_subject_ids: Part B free-text grade subjects (no marks).
-- ============================================================

DROP FUNCTION IF EXISTS public.atr_create_examination(
  character varying, uuid, character varying, uuid, uuid, uuid[], uuid[],
  date, time without time zone, time without time zone,
  integer, integer, character varying, text, integer[], integer[], uuid,
  date[], time without time zone[], time without time zone[]
);

CREATE OR REPLACE FUNCTION public.atr_create_examination(
  p_test_name character varying,
  p_exam_type_id uuid,
  p_exam_status character varying,
  p_class_id uuid,
  p_section_id uuid DEFAULT NULL::uuid,
  p_section_ids uuid[] DEFAULT NULL::uuid[],
  p_subject_ids uuid[] DEFAULT NULL::uuid[],
  p_exam_date date DEFAULT NULL::date,
  p_start_time time without time zone DEFAULT NULL::time without time zone,
  p_end_time time without time zone DEFAULT NULL::time without time zone,
  p_max_marks integer DEFAULT NULL::integer,
  p_passing_marks integer DEFAULT NULL::integer,
  p_invigilator character varying DEFAULT NULL::character varying,
  p_instructions text DEFAULT NULL::text,
  p_subject_max_marks integer[] DEFAULT NULL::integer[],
  p_subject_passing_marks integer[] DEFAULT NULL::integer[],
  p_created_by uuid DEFAULT NULL::uuid,
  p_subject_exam_dates date[] DEFAULT NULL::date[],
  p_subject_start_times time without time zone[] DEFAULT NULL::time without time zone[],
  p_subject_end_times time without time zone[] DEFAULT NULL::time without time zone[],
  p_part_b_subject_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_exam_id UUID;
  v_section_class_id UUID;
  v_section_ids UUID[];
  v_sid UUID;
  v_subject_count INT;
  v_n INT;
  v_total_max INT := 0;
  v_total_pass INT;
  v_i INT;
  v_subject_dates DATE[];
  v_subject_starts TIME[];
  v_subject_ends TIME[];
  v_parent_date DATE;
  v_parent_start TIME;
  v_parent_end TIME;
  v_part_b_ids UUID[];
  v_part_b_n INT;
  v_part_b_count INT;
  v_overlap INT;
BEGIN
  IF p_test_name IS NULL OR BTRIM(p_test_name) = '' THEN
    RETURN QUERY SELECT 400, 'Test name is required', NULL::jsonb; RETURN;
  END IF;
  IF p_exam_type_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Exam type is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM exam_types WHERE id = p_exam_type_id) THEN
    RETURN QUERY SELECT 400, 'Exam type not found', NULL::jsonb; RETURN;
  END IF;
  IF p_exam_status IS NULL OR p_exam_status NOT IN ('scheduled','completed','cancelled') THEN
    RETURN QUERY SELECT 400, 'Exam status is required', NULL::jsonb; RETURN;
  END IF;
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Class is required', NULL::jsonb; RETURN;
  END IF;
  IF p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR array_length(p_subject_ids, 1) < 1 THEN
    RETURN QUERY SELECT 400, 'At least one subject is required', NULL::jsonb; RETURN;
  END IF;
  v_n := array_length(p_subject_ids, 1);

  IF p_subject_max_marks IS NOT NULL THEN
    IF array_length(p_subject_max_marks, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'Marks arrays must match the number of subjects', NULL::jsonb; RETURN;
    END IF;
    IF p_subject_passing_marks IS NOT NULL AND array_length(p_subject_passing_marks, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'Marks arrays must match the number of subjects', NULL::jsonb; RETURN;
    END IF;
    v_total_max := 0;
    v_total_pass := NULL;
    FOR v_i IN 1..v_n LOOP
      IF p_subject_max_marks[v_i] IS NULL OR p_subject_max_marks[v_i] <= 0 THEN
        RETURN QUERY SELECT 400, 'Each subject max_marks must be greater than 0', NULL::jsonb; RETURN;
      END IF;
      IF p_subject_passing_marks IS NOT NULL AND p_subject_passing_marks[v_i] IS NOT NULL THEN
        IF p_subject_passing_marks[v_i] < 0 OR p_subject_passing_marks[v_i] > p_subject_max_marks[v_i] THEN
          RETURN QUERY SELECT 400, 'Each subject passing_marks must be between 0 and that subject max_marks', NULL::jsonb; RETURN;
        END IF;
        v_total_pass := COALESCE(v_total_pass, 0) + p_subject_passing_marks[v_i];
      END IF;
      v_total_max := v_total_max + p_subject_max_marks[v_i];
    END LOOP;
  ELSIF p_subject_passing_marks IS NOT NULL THEN
    RETURN QUERY SELECT 400, 'subject_max_marks is required when sending subject_passing_marks', NULL::jsonb; RETURN;
  ELSE
    IF p_max_marks IS NULL OR p_max_marks <= 0 THEN
      RETURN QUERY SELECT 400, 'Max Marks must be greater than 0', NULL::jsonb; RETURN;
    END IF;
    IF p_passing_marks IS NOT NULL THEN
      IF p_passing_marks < 0 THEN
        RETURN QUERY SELECT 400, 'Passing Marks must be 0 or more', NULL::jsonb; RETURN;
      END IF;
      IF p_passing_marks > p_max_marks THEN
        RETURN QUERY SELECT 400, 'Passing Marks must be less than or equal to Max Marks', NULL::jsonb; RETURN;
      END IF;
    END IF;
    v_total_max := p_max_marks * v_n;
    v_total_pass := CASE WHEN p_passing_marks IS NULL THEN NULL ELSE p_passing_marks * v_n END;
  END IF;

  -- Per-subject schedule (dates required via array or fallback p_exam_date)
  IF p_subject_exam_dates IS NOT NULL THEN
    IF array_length(p_subject_exam_dates, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'Subject exam date arrays must match the number of subjects', NULL::jsonb; RETURN;
    END IF;
    FOR v_i IN 1..v_n LOOP
      IF p_subject_exam_dates[v_i] IS NULL THEN
        RETURN QUERY SELECT 400, 'Each subject exam_date is required', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
    v_subject_dates := p_subject_exam_dates;
  ELSE
    IF p_exam_date IS NULL THEN
      RETURN QUERY SELECT 400, 'Exam date is required', NULL::jsonb; RETURN;
    END IF;
    v_subject_dates := array_fill(p_exam_date, ARRAY[v_n]);
  END IF;

  IF p_subject_start_times IS NOT NULL THEN
    IF array_length(p_subject_start_times, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'Subject start time arrays must match the number of subjects', NULL::jsonb; RETURN;
    END IF;
    v_subject_starts := p_subject_start_times;
  ELSE
    v_subject_starts := array_fill(p_start_time, ARRAY[v_n]);
  END IF;

  IF p_subject_end_times IS NOT NULL THEN
    IF array_length(p_subject_end_times, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'Subject end time arrays must match the number of subjects', NULL::jsonb; RETURN;
    END IF;
    v_subject_ends := p_subject_end_times;
  ELSE
    v_subject_ends := array_fill(p_end_time, ARRAY[v_n]);
  END IF;

  FOR v_i IN 1..v_n LOOP
    IF v_subject_starts[v_i] IS NOT NULL AND v_subject_ends[v_i] IS NOT NULL THEN
      IF v_subject_ends[v_i] <= v_subject_starts[v_i] THEN
        RETURN QUERY SELECT 400, 'End Time must be greater than Start Time', NULL::jsonb; RETURN;
      END IF;
    END IF;
  END LOOP;

  -- Parent schedule = earliest subject sitting
  SELECT t.d, t.st, t.et
  INTO v_parent_date, v_parent_start, v_parent_end
  FROM unnest(v_subject_dates, v_subject_starts, v_subject_ends) AS t(d, st, et)
  ORDER BY t.d ASC, t.st ASC NULLS LAST
  LIMIT 1;

  IF v_total_pass IS NOT NULL AND v_total_pass > v_total_max THEN
    RETURN QUERY SELECT 400, 'Total passing marks must be less than or equal to total max marks', NULL::jsonb; RETURN;
  END IF;
  -- invigilator is optional (store NULL when blank)

  IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
    RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
  END IF;

  IF COALESCE(array_length(p_section_ids, 1), 0) > 0 THEN
    SELECT COALESCE(array_agg(x.sid), ARRAY[]::uuid[])
    INTO v_section_ids
    FROM (
      SELECT DISTINCT unnest(p_section_ids) AS sid
    ) x
    WHERE x.sid IS NOT NULL;

    IF COALESCE(array_length(v_section_ids, 1), 0) < 1 THEN
      RETURN QUERY SELECT 400, 'section_ids must contain at least one section id', NULL::jsonb; RETURN;
    END IF;

    FOREACH v_sid IN ARRAY v_section_ids LOOP
      SELECT class_id INTO v_section_class_id FROM sections WHERE id = v_sid;
      IF v_section_class_id IS NULL THEN
        RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
      END IF;
      IF v_section_class_id <> p_class_id THEN
        RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  ELSIF p_section_id IS NOT NULL THEN
    SELECT class_id INTO v_section_class_id FROM sections WHERE id = p_section_id;
    IF v_section_class_id IS NULL THEN
      RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
    END IF;
    IF v_section_class_id <> p_class_id THEN
      RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_subject_count
  FROM subjects
  WHERE id = ANY(p_subject_ids) AND is_deleted = FALSE;

  IF v_subject_count <> v_n THEN
    RETURN QUERY SELECT 400, 'One or more subjects are invalid', NULL::jsonb; RETURN;
  END IF;

  -- Optional Part B subjects (no marks config; must not overlap Part A)
  IF p_part_b_subject_ids IS NULL THEN
    v_part_b_ids := ARRAY[]::uuid[];
  ELSE
    SELECT COALESCE(array_agg(DISTINCT x.sid), ARRAY[]::uuid[])
    INTO v_part_b_ids
    FROM (SELECT unnest(p_part_b_subject_ids) AS sid) x
    WHERE x.sid IS NOT NULL;
  END IF;
  v_part_b_n := COALESCE(array_length(v_part_b_ids, 1), 0);
  IF v_part_b_n > 0 THEN
    SELECT COUNT(*) INTO v_part_b_count
    FROM subjects
    WHERE id = ANY(v_part_b_ids) AND is_deleted = FALSE;
    IF v_part_b_count <> v_part_b_n THEN
      RETURN QUERY SELECT 400, 'One or more Part B subjects are invalid', NULL::jsonb; RETURN;
    END IF;
    SELECT COUNT(*) INTO v_overlap
    FROM unnest(v_part_b_ids) AS pb(sid)
    WHERE pb.sid = ANY(p_subject_ids);
    IF v_overlap > 0 THEN
      RETURN QUERY SELECT 400, 'Part B subjects must not overlap Part A subjects', NULL::jsonb; RETURN;
    END IF;
  END IF;

  -- Duplicate prevention for targeted sections (use earliest parent sitting).
  IF COALESCE(array_length(v_section_ids, 1), 0) > 0 THEN
    FOREACH v_sid IN ARRAY v_section_ids LOOP
      IF EXISTS (
        SELECT 1
        FROM examinations e
        WHERE e.class_id = p_class_id
          AND e.exam_date = v_parent_date
          AND (v_parent_start IS NULL OR e.start_time = v_parent_start)
          AND (v_parent_end IS NULL OR e.end_time = v_parent_end)
          AND e.exam_type_id = p_exam_type_id
          AND e.exam_status <> 'cancelled'
          AND (
            e.section_id = v_sid
            OR EXISTS (SELECT 1 FROM examination_sections es WHERE es.examination_id = e.id AND es.section_id = v_sid)
            OR (e.section_id IS NULL AND NOT EXISTS (SELECT 1 FROM examination_sections es2 WHERE es2.examination_id = e.id))
          )
      ) THEN
        RETURN QUERY SELECT 409, 'An examination already exists for this section and time', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM examinations e
      WHERE e.class_id = p_class_id
        AND e.exam_date = v_parent_date
        AND (v_parent_start IS NULL OR e.start_time = v_parent_start)
        AND (v_parent_end IS NULL OR e.end_time = v_parent_end)
        AND e.exam_type_id = p_exam_type_id
        AND e.exam_status <> 'cancelled'
        AND (
          ((p_section_id IS NULL AND e.section_id IS NULL) OR e.section_id = p_section_id)
          OR (p_section_id IS NOT NULL AND EXISTS (SELECT 1 FROM examination_sections es WHERE es.examination_id = e.id AND es.section_id = p_section_id))
          OR (p_section_id IS NOT NULL AND e.section_id IS NULL AND NOT EXISTS (SELECT 1 FROM examination_sections es2 WHERE es2.examination_id = e.id))
        )
    ) THEN
      RETURN QUERY SELECT 409, 'An examination already exists for this section and time', NULL::jsonb; RETURN;
    END IF;
  END IF;

  INSERT INTO examinations (
    id,
    test_name,
    exam_type_id,
    exam_status,
    class_id,
    section_id,
    exam_date,
    start_time,
    end_time,
    max_marks,
    passing_marks,
    invigilator,
    instructions,
    created_by
  ) VALUES (
    uuid_generate_v4(),
    BTRIM(p_test_name),
    p_exam_type_id,
    p_exam_status,
    p_class_id,
    CASE WHEN COALESCE(array_length(v_section_ids, 1), 0) > 0 THEN NULL ELSE p_section_id END,
    v_parent_date,
    v_parent_start,
    v_parent_end,
    v_total_max,
    v_total_pass,
    NULLIF(BTRIM(COALESCE(p_invigilator,'')), ''),
    NULLIF(BTRIM(COALESCE(p_instructions,'')), ''),
    p_created_by
  )
  RETURNING id INTO v_exam_id;

  IF COALESCE(array_length(v_section_ids, 1), 0) > 0 THEN
    INSERT INTO examination_sections (examination_id, section_id)
    SELECT v_exam_id, sid
    FROM unnest(v_section_ids) AS sid;
  END IF;

  FOR v_i IN 1..v_n LOOP
    INSERT INTO examination_subjects (
      id, examination_id, subject_id, max_marks, passing_marks, exam_date, start_time, end_time, is_part_b
    ) VALUES (
      uuid_generate_v4(),
      v_exam_id,
      p_subject_ids[v_i],
      CASE WHEN p_subject_max_marks IS NOT NULL THEN p_subject_max_marks[v_i] ELSE p_max_marks END,
      CASE
        WHEN p_subject_max_marks IS NOT NULL THEN
          CASE WHEN p_subject_passing_marks IS NOT NULL THEN p_subject_passing_marks[v_i] ELSE NULL END
        ELSE p_passing_marks
      END,
      v_subject_dates[v_i],
      v_subject_starts[v_i],
      v_subject_ends[v_i],
      FALSE
    );
  END LOOP;

  IF v_part_b_n > 0 THEN
    INSERT INTO examination_subjects (
      id, examination_id, subject_id, max_marks, passing_marks, exam_date, start_time, end_time, is_part_b
    )
    SELECT
      uuid_generate_v4(),
      v_exam_id,
      sid,
      NULL,
      NULL,
      v_parent_date,
      v_parent_start,
      v_parent_end,
      TRUE
    FROM unnest(v_part_b_ids) AS sid;
  END IF;

  RETURN QUERY
  SELECT 201,
         'Examination created successfully',
         jsonb_build_object(
           'id', v_exam_id,
           'ids', to_jsonb(ARRAY[v_exam_id]::uuid[]),
           'count', 1
         );
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;


CREATE OR REPLACE FUNCTION public.atr_get_examinations(p_search text DEFAULT NULL::text, p_class_id uuid DEFAULT NULL::uuid, p_section_id uuid DEFAULT NULL::uuid, p_status character varying DEFAULT NULL::character varying, p_exam_type_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    200,
    'Examinations fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  FROM (
    SELECT
      e.id,
      e.test_name,
      e.exam_type_id,
      et.name AS exam_type_name,
      e.exam_status,
      e.class_id,
      e.section_id,
      (
        SELECT COALESCE(jsonb_agg(es.section_id ORDER BY es.section_id), '[]'::jsonb)
        FROM examination_sections es
        WHERE es.examination_id = e.id
      ) AS section_ids,
      e.exam_date,
      e.start_time,
      e.end_time,
      e.max_marks,
      e.passing_marks,
      e.invigilator,
      e.instructions,
      e.created_at,
      EXISTS (SELECT 1 FROM examination_results r WHERE r.examination_id = e.id) AS has_results,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'code', s.code,
            'max_marks', es.max_marks,
            'passing_marks', es.passing_marks,
            'exam_date', es.exam_date,
            'start_time', es.start_time,
            'end_time', es.end_time,
            'is_part_b', es.is_part_b
          ) ORDER BY es.is_part_b ASC, s.sort_order, s.name
        ), '[]'::jsonb)
        FROM examination_subjects es
        JOIN subjects s ON s.id = es.subject_id
        WHERE es.examination_id = e.id
      ) AS subjects
    FROM examinations e
    JOIN exam_types et ON et.id = e.exam_type_id
    WHERE
      (p_class_id IS NULL OR e.class_id = p_class_id)
      AND (
        p_section_id IS NULL
        OR e.section_id = p_section_id
        OR EXISTS (SELECT 1 FROM examination_sections es3 WHERE es3.examination_id = e.id AND es3.section_id = p_section_id)
        OR (e.section_id IS NULL AND NOT EXISTS (SELECT 1 FROM examination_sections es4 WHERE es4.examination_id = e.id))
      )
      AND (p_status IS NULL OR e.exam_status = p_status)
      AND (p_exam_type_id IS NULL OR e.exam_type_id = p_exam_type_id)
      AND (
        p_search IS NULL
        OR e.test_name ILIKE '%' || p_search || '%'
        OR et.name ILIKE '%' || p_search || '%'
        OR e.invigilator ILIKE '%' || p_search || '%'
      )
    ORDER BY e.exam_date DESC, e.start_time DESC
  ) x;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;


CREATE OR REPLACE FUNCTION public.atr_get_examination_by_id(p_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_row JSONB;
BEGIN
  SELECT to_jsonb(x) INTO v_row
  FROM (
    SELECT
      e.id,
      e.test_name,
      e.exam_type_id,
      et.name AS exam_type_name,
      e.exam_status,
      e.class_id,
      e.section_id,
      (
        SELECT COALESCE(jsonb_agg(es.section_id ORDER BY es.section_id), '[]'::jsonb)
        FROM examination_sections es
        WHERE es.examination_id = e.id
      ) AS section_ids,
      e.exam_date,
      e.start_time,
      e.end_time,
      e.max_marks,
      e.passing_marks,
      e.invigilator,
      e.instructions,
      e.created_by,
      e.updated_by,
      e.created_at,
      e.updated_at,
      EXISTS (SELECT 1 FROM examination_results r WHERE r.examination_id = e.id) AS has_results,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'code', s.code,
            'max_marks', es.max_marks,
            'passing_marks', es.passing_marks,
            'exam_date', es.exam_date,
            'start_time', es.start_time,
            'end_time', es.end_time,
            'is_part_b', es.is_part_b
          ) ORDER BY es.is_part_b ASC, s.sort_order, s.name
        ), '[]'::jsonb)
        FROM examination_subjects es
        JOIN subjects s ON s.id = es.subject_id
        WHERE es.examination_id = e.id
      ) AS subjects
    FROM examinations e
    JOIN exam_types et ON et.id = e.exam_type_id
    WHERE e.id = p_id
  ) x;

  IF v_row IS NULL THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY SELECT 200, 'Examination fetched successfully', v_row;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;


DROP FUNCTION IF EXISTS public.atr_update_examination(
  uuid, character varying, uuid, character varying, uuid, uuid, uuid[], uuid[],
  date, time without time zone, time without time zone,
  integer, integer, character varying, text, integer[], integer[], uuid,
  date[], time without time zone[], time without time zone[]
);

CREATE OR REPLACE FUNCTION public.atr_update_examination(
  p_id uuid,
  p_test_name character varying DEFAULT NULL::character varying,
  p_exam_type_id uuid DEFAULT NULL::uuid,
  p_exam_status character varying DEFAULT NULL::character varying,
  p_class_id uuid DEFAULT NULL::uuid,
  p_section_id uuid DEFAULT NULL::uuid,
  p_section_ids uuid[] DEFAULT NULL::uuid[],
  p_subject_ids uuid[] DEFAULT NULL::uuid[],
  p_exam_date date DEFAULT NULL::date,
  p_start_time time without time zone DEFAULT NULL::time without time zone,
  p_end_time time without time zone DEFAULT NULL::time without time zone,
  p_max_marks integer DEFAULT NULL::integer,
  p_passing_marks integer DEFAULT NULL::integer,
  p_invigilator character varying DEFAULT NULL::character varying,
  p_instructions text DEFAULT NULL::text,
  p_subject_max_marks integer[] DEFAULT NULL::integer[],
  p_subject_passing_marks integer[] DEFAULT NULL::integer[],
  p_updated_by uuid DEFAULT NULL::uuid,
  p_subject_exam_dates date[] DEFAULT NULL::date[],
  p_subject_start_times time without time zone[] DEFAULT NULL::time without time zone[],
  p_subject_end_times time without time zone[] DEFAULT NULL::time without time zone[],
  p_part_b_subject_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_exists BOOLEAN;
  v_class UUID;
  v_section_class_id UUID;
  v_section_ids UUID[];
  v_existing_section_ids UUID[];
  v_sid UUID;
  v_subject_count INT;
  v_start TIME;
  v_end TIME;
  v_max_final INT;
  v_pass_final INT;
  v_n INT;
  v_total_max INT;
  v_total_pass INT;
  v_i INT;
  v_agg_max INT;
  v_agg_pass INT;
  v_cnt INT;
  v_row_es RECORD;
  v_exam_type_id UUID;
  v_exam_date DATE;
  v_section_id UUID;
  v_is_all_sections BOOLEAN := FALSE;
  v_comp_exam_class_id UUID;
  v_comp_exam_section_id UUID;
  v_comp_exam_section_ids UUID[];
  v_comp_total_students INT;
  v_comp_students_with_results INT;
  v_comp_subject_count INT;
  v_comp_incomplete_marks INT;
  v_subject_dates DATE[];
  v_subject_starts TIME[];
  v_subject_ends TIME[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM examinations WHERE id = p_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;

  -- Block completion if zero marks have been entered.
  IF p_exam_status = 'completed'
     AND NOT EXISTS (SELECT 1 FROM examination_results r WHERE r.examination_id = p_id)
  THEN
    RETURN QUERY SELECT 400,
      'Cannot mark as completed: no marks have been entered for any student',
      NULL::jsonb;
    RETURN;
  END IF;

  -- If ONLY exam_status is being changed, allow it even when marks exist (e.g. marking as completed).
  -- Otherwise, block structural edits once results have been entered.
  IF EXISTS (SELECT 1 FROM examination_results r WHERE r.examination_id = p_id) THEN
    IF p_exam_status IS NOT NULL
       AND p_test_name IS NULL
       AND p_exam_type_id IS NULL
       AND p_class_id IS NULL
       AND p_section_id IS NULL
       AND p_section_ids IS NULL
       AND p_subject_ids IS NULL
       AND p_exam_date IS NULL
       AND p_start_time IS NULL
       AND p_end_time IS NULL
       AND p_max_marks IS NULL
       AND p_passing_marks IS NULL
       AND p_subject_max_marks IS NULL
       AND p_subject_passing_marks IS NULL
       AND p_subject_exam_dates IS NULL
       AND p_subject_start_times IS NULL
       AND p_subject_end_times IS NULL
       AND p_part_b_subject_ids IS NULL
    THEN
      -- When marking as completed, validate all students have all marks filled.
      IF p_exam_status = 'completed' THEN
        SELECT e.class_id, e.section_id
        INTO v_comp_exam_class_id, v_comp_exam_section_id
        FROM examinations e WHERE e.id = p_id;

        SELECT COALESCE(array_agg(es2.section_id), ARRAY[]::uuid[])
        INTO v_comp_exam_section_ids
        FROM examination_sections es2 WHERE es2.examination_id = p_id;

        -- Count eligible students (active students in the exam's class/section scope)
        SELECT COUNT(*) INTO v_comp_total_students
        FROM students st
        WHERE st.class_id = v_comp_exam_class_id
          AND st.is_active = TRUE
          AND (
            (v_comp_exam_section_id IS NOT NULL AND st.section_id = v_comp_exam_section_id)
            OR (COALESCE(array_length(v_comp_exam_section_ids, 1), 0) > 0 AND st.section_id = ANY(v_comp_exam_section_ids))
            OR (v_comp_exam_section_id IS NULL AND COALESCE(array_length(v_comp_exam_section_ids, 1), 0) = 0)
          );

        SELECT COUNT(*) INTO v_comp_students_with_results
        FROM examination_results r WHERE r.examination_id = p_id;

        IF v_comp_students_with_results < v_comp_total_students THEN
          RETURN QUERY SELECT 400,
            'Cannot mark as completed: marks have not been entered for all students ('
              || v_comp_students_with_results || ' of ' || v_comp_total_students || ' done)',
            NULL::jsonb;
          RETURN;
        END IF;

        SELECT COUNT(*) INTO v_comp_subject_count
        FROM examination_subjects WHERE examination_id = p_id;

        -- Incomplete: Part A missing mark/AB, or Part B missing grade_text
        SELECT COUNT(*) INTO v_comp_incomplete_marks
        FROM examination_results r
        WHERE r.examination_id = p_id
          AND EXISTS (
            SELECT 1
            FROM examination_subjects esub
            LEFT JOIN examination_result_marks m
              ON m.result_id = r.id AND m.subject_id = esub.subject_id
            WHERE esub.examination_id = p_id
              AND (
                (
                  esub.is_part_b = FALSE
                  AND (m.id IS NULL OR (m.mark IS NULL AND m.is_absent = FALSE))
                )
                OR
                (
                  esub.is_part_b = TRUE
                  AND (
                    m.id IS NULL
                    OR m.grade_text IS NULL
                    OR BTRIM(m.grade_text) = ''
                    OR LENGTH(BTRIM(m.grade_text)) > 50
                  )
                )
              )
          );

        IF v_comp_incomplete_marks > 0 THEN
          RETURN QUERY SELECT 400,
            'Cannot complete: ' || v_comp_incomplete_marks
              || ' student(s) still missing marks or Part B grades.',
            NULL::jsonb;
          RETURN;
        END IF;
      END IF;

      UPDATE examinations
      SET exam_status = p_exam_status,
          updated_by = p_updated_by,
          updated_at = NOW()
      WHERE id = p_id;
      RETURN QUERY SELECT 200, 'Examination status updated successfully', jsonb_build_object('id', p_id);
      RETURN;
    ELSE
      RETURN QUERY
      SELECT 409, 'Marks already exist for this exam. Cancel and create a new exam.', NULL::jsonb;
      RETURN;
    END IF;
  END IF;

  IF (p_subject_max_marks IS NOT NULL OR p_subject_passing_marks IS NOT NULL) AND p_subject_ids IS NULL THEN
    RETURN QUERY SELECT 400, 'subject_ids is required when sending per-subject marks arrays', NULL::jsonb; RETURN;
  END IF;

  IF (p_subject_exam_dates IS NOT NULL OR p_subject_start_times IS NOT NULL OR p_subject_end_times IS NOT NULL)
     AND p_subject_ids IS NULL THEN
    RETURN QUERY SELECT 400, 'subject_ids is required when sending per-subject schedule arrays', NULL::jsonb; RETURN;
  END IF;

  SELECT class_id INTO v_class FROM examinations WHERE id = p_id;
  IF p_class_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
      RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
    END IF;
    v_class := p_class_id;
  END IF;

  -- Load existing multi-section ids (if any)
  SELECT COALESCE(array_agg(es.section_id), ARRAY[]::uuid[])
  INTO v_existing_section_ids
  FROM examination_sections es
  WHERE es.examination_id = p_id;

  -- Resolve desired section targeting:
  -- - p_section_ids sent => authoritative (can be empty array meaning "All sections")
  -- - else, p_section_id can switch to single-section (clears join rows)
  IF p_section_ids IS NOT NULL THEN
    SELECT COALESCE(array_agg(x.sid), ARRAY[]::uuid[])
    INTO v_section_ids
    FROM (
      SELECT DISTINCT unnest(p_section_ids) AS sid
    ) x
    WHERE x.sid IS NOT NULL;

    IF COALESCE(array_length(v_section_ids, 1), 0) = 0 THEN
      v_is_all_sections := TRUE;
      v_section_id := NULL::uuid;
    ELSIF array_length(v_section_ids, 1) = 1 THEN
      v_section_id := v_section_ids[1];
      v_section_ids := ARRAY[]::uuid[];
    ELSE
      v_section_id := NULL::uuid;
      v_is_all_sections := FALSE;
    END IF;
  ELSIF p_section_id IS NOT NULL THEN
    v_section_id := p_section_id;
    v_section_ids := ARRAY[]::uuid[];
    v_is_all_sections := FALSE;
  ELSE
    v_section_ids := COALESCE(v_existing_section_ids, ARRAY[]::uuid[]);
    v_is_all_sections := (v_section_id IS NULL AND COALESCE(array_length(v_section_ids, 1), 0) = 0);
  END IF;

  -- Validate desired section ids belong to class
  IF v_section_id IS NOT NULL THEN
    SELECT class_id INTO v_section_class_id FROM sections WHERE id = v_section_id;
    IF v_section_class_id IS NULL THEN
      RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
    END IF;
    IF v_section_class_id <> v_class THEN
      RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
    END IF;
  END IF;
  IF COALESCE(array_length(v_section_ids, 1), 0) > 0 THEN
    FOREACH v_sid IN ARRAY v_section_ids LOOP
      SELECT class_id INTO v_section_class_id FROM sections WHERE id = v_sid;
      IF v_section_class_id IS NULL THEN
        RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
      END IF;
      IF v_section_class_id <> v_class THEN
        RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  END IF;

  IF p_exam_status IS NOT NULL AND p_exam_status NOT IN ('scheduled','completed','cancelled') THEN
    RETURN QUERY SELECT 400, 'Invalid exam status', NULL::jsonb; RETURN;
  END IF;

  IF p_exam_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM exam_types WHERE id = p_exam_type_id) THEN
    RETURN QUERY SELECT 400, 'Exam type not found', NULL::jsonb; RETURN;
  END IF;

  SELECT exam_type_id, exam_date, section_id, start_time, end_time, max_marks, passing_marks
  INTO v_exam_type_id, v_exam_date, v_section_id, v_start, v_end, v_max_final, v_pass_final
  FROM examinations WHERE id = p_id;

  v_exam_type_id := COALESCE(p_exam_type_id, v_exam_type_id);
  v_exam_date := COALESCE(p_exam_date, v_exam_date);

  v_start := COALESCE(p_start_time, v_start);
  v_end := COALESCE(p_end_time, v_end);

  IF p_subject_ids IS NOT NULL THEN
    v_n := array_length(p_subject_ids, 1);
    IF v_n IS NULL OR v_n < 1 THEN
      RETURN QUERY SELECT 400, 'At least one subject is required', NULL::jsonb; RETURN;
    END IF;
    SELECT COUNT(*) INTO v_subject_count
    FROM subjects
    WHERE id = ANY(p_subject_ids) AND is_deleted = FALSE;
    IF v_subject_count <> v_n THEN
      RETURN QUERY SELECT 400, 'One or more subjects are invalid', NULL::jsonb; RETURN;
    END IF;

    -- Schedule required when replacing subjects
    IF p_subject_exam_dates IS NOT NULL THEN
      IF array_length(p_subject_exam_dates, 1) IS DISTINCT FROM v_n THEN
        RETURN QUERY SELECT 400, 'Subject exam date arrays must match the number of subjects', NULL::jsonb; RETURN;
      END IF;
      FOR v_i IN 1..v_n LOOP
        IF p_subject_exam_dates[v_i] IS NULL THEN
          RETURN QUERY SELECT 400, 'Each subject exam_date is required', NULL::jsonb; RETURN;
        END IF;
      END LOOP;
      v_subject_dates := p_subject_exam_dates;
    ELSIF p_exam_date IS NOT NULL THEN
      v_subject_dates := array_fill(p_exam_date, ARRAY[v_n]);
    ELSE
      RETURN QUERY SELECT 400, 'Subject exam dates are required when replacing subjects', NULL::jsonb; RETURN;
    END IF;

    IF p_subject_start_times IS NOT NULL THEN
      IF array_length(p_subject_start_times, 1) IS DISTINCT FROM v_n THEN
        RETURN QUERY SELECT 400, 'Subject start time arrays must match the number of subjects', NULL::jsonb; RETURN;
      END IF;
      v_subject_starts := p_subject_start_times;
    ELSE
      v_subject_starts := array_fill(p_start_time, ARRAY[v_n]);
    END IF;

    IF p_subject_end_times IS NOT NULL THEN
      IF array_length(p_subject_end_times, 1) IS DISTINCT FROM v_n THEN
        RETURN QUERY SELECT 400, 'Subject end time arrays must match the number of subjects', NULL::jsonb; RETURN;
      END IF;
      v_subject_ends := p_subject_end_times;
    ELSE
      v_subject_ends := array_fill(p_end_time, ARRAY[v_n]);
    END IF;

    FOR v_i IN 1..v_n LOOP
      IF v_subject_starts[v_i] IS NOT NULL AND v_subject_ends[v_i] IS NOT NULL THEN
        IF v_subject_ends[v_i] <= v_subject_starts[v_i] THEN
          RETURN QUERY SELECT 400, 'End Time must be greater than Start Time', NULL::jsonb; RETURN;
        END IF;
      END IF;
    END LOOP;

    IF p_subject_max_marks IS NOT NULL THEN
      IF array_length(p_subject_max_marks, 1) IS DISTINCT FROM v_n THEN
        RETURN QUERY SELECT 400, 'Marks arrays must match the number of subjects', NULL::jsonb; RETURN;
      END IF;
      IF p_subject_passing_marks IS NOT NULL AND array_length(p_subject_passing_marks, 1) IS DISTINCT FROM v_n THEN
        RETURN QUERY SELECT 400, 'Marks arrays must match the number of subjects', NULL::jsonb; RETURN;
      END IF;
      v_total_max := 0;
      v_total_pass := NULL;
      FOR v_i IN 1..v_n LOOP
        IF p_subject_max_marks[v_i] IS NULL OR p_subject_max_marks[v_i] <= 0 THEN
          RETURN QUERY SELECT 400, 'Each subject max_marks must be greater than 0', NULL::jsonb; RETURN;
        END IF;
        IF p_subject_passing_marks IS NOT NULL AND p_subject_passing_marks[v_i] IS NOT NULL THEN
          IF p_subject_passing_marks[v_i] < 0 OR p_subject_passing_marks[v_i] > p_subject_max_marks[v_i] THEN
            RETURN QUERY SELECT 400, 'Each subject passing_marks must be between 0 and that subject max_marks', NULL::jsonb; RETURN;
          END IF;
          v_total_pass := COALESCE(v_total_pass, 0) + p_subject_passing_marks[v_i];
        END IF;
        v_total_max := v_total_max + p_subject_max_marks[v_i];
      END LOOP;
      v_max_final := v_total_max;
      v_pass_final := v_total_pass;
    ELSIF p_subject_passing_marks IS NOT NULL THEN
      RETURN QUERY SELECT 400, 'subject_max_marks is required when sending subject_passing_marks', NULL::jsonb; RETURN;
    ELSE
      IF p_max_marks IS NULL OR p_max_marks <= 0 THEN
        RETURN QUERY SELECT 400, 'Max Marks must be greater than 0 when replacing subjects without per-subject marks arrays', NULL::jsonb; RETURN;
      END IF;
      IF p_passing_marks IS NOT NULL THEN
        IF p_passing_marks < 0 THEN
          RETURN QUERY SELECT 400, 'Passing Marks must be 0 or more when replacing subjects without per-subject marks arrays', NULL::jsonb; RETURN;
        END IF;
        IF p_passing_marks > p_max_marks THEN
          RETURN QUERY SELECT 400, 'Passing Marks must be less than or equal to Max Marks', NULL::jsonb; RETURN;
        END IF;
      END IF;
      v_max_final := p_max_marks * v_n;
      v_pass_final := CASE WHEN p_passing_marks IS NULL THEN NULL ELSE p_passing_marks * v_n END;
    END IF;

    DELETE FROM examination_subjects WHERE examination_id = p_id;
    FOR v_i IN 1..v_n LOOP
      INSERT INTO examination_subjects (
        id, examination_id, subject_id, max_marks, passing_marks, exam_date, start_time, end_time, is_part_b
      ) VALUES (
        uuid_generate_v4(),
        p_id,
        p_subject_ids[v_i],
        CASE WHEN p_subject_max_marks IS NOT NULL THEN p_subject_max_marks[v_i] ELSE p_max_marks END,
        CASE
          WHEN p_subject_max_marks IS NOT NULL THEN
            CASE WHEN p_subject_passing_marks IS NOT NULL THEN p_subject_passing_marks[v_i] ELSE NULL END
          ELSE p_passing_marks
        END,
        v_subject_dates[v_i],
        v_subject_starts[v_i],
        v_subject_ends[v_i],
        FALSE
      );
    END LOOP;

    SELECT COUNT(*) INTO v_cnt FROM examination_subjects WHERE examination_id = p_id AND is_part_b = FALSE;
    IF v_cnt < 1 THEN
      RETURN QUERY SELECT 400, 'At least one Part A subject is required', NULL::jsonb; RETURN;
    END IF;

    -- Recompute parent schedule from Part A examination_subjects only
    SELECT es.exam_date, es.start_time, es.end_time
    INTO v_exam_date, v_start, v_end
    FROM examination_subjects es
    WHERE es.examination_id = p_id AND es.is_part_b = FALSE
    ORDER BY es.exam_date ASC, es.start_time ASC NULLS LAST
    LIMIT 1;

    -- Replace Part B subjects when Part A subjects are replaced (NULL => clear Part B)
    IF COALESCE(array_length(p_part_b_subject_ids, 1), 0) > 0 THEN
      SELECT COUNT(*) INTO v_subject_count
      FROM subjects
      WHERE id = ANY(p_part_b_subject_ids) AND is_deleted = FALSE;
      IF v_subject_count <> array_length(p_part_b_subject_ids, 1) THEN
        RETURN QUERY SELECT 400, 'One or more Part B subjects are invalid', NULL::jsonb; RETURN;
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(p_part_b_subject_ids) AS pb(sid)
        WHERE pb.sid = ANY(p_subject_ids)
      ) THEN
        RETURN QUERY SELECT 400, 'Part B subjects must not overlap Part A subjects', NULL::jsonb; RETURN;
      END IF;
      INSERT INTO examination_subjects (
        id, examination_id, subject_id, max_marks, passing_marks, exam_date, start_time, end_time, is_part_b
      )
      SELECT
        uuid_generate_v4(),
        p_id,
        sid,
        NULL,
        NULL,
        v_exam_date,
        v_start,
        v_end,
        TRUE
      FROM unnest(p_part_b_subject_ids) AS sid
      WHERE sid IS NOT NULL;
    END IF;

  ELSIF (p_max_marks IS NOT NULL OR p_passing_marks IS NOT NULL) THEN
    SELECT COUNT(*) INTO v_cnt FROM examination_subjects WHERE examination_id = p_id AND is_part_b = FALSE;
    IF v_cnt < 1 THEN
      RETURN QUERY SELECT 400, 'Examination has no subjects linked', NULL::jsonb; RETURN;
    END IF;
    SELECT COALESCE(SUM(max_marks), 0), SUM(passing_marks) INTO v_agg_max, v_agg_pass
    FROM examination_subjects WHERE examination_id = p_id AND is_part_b = FALSE;
    v_agg_max := COALESCE(p_max_marks, v_agg_max);
    IF p_passing_marks IS NOT NULL THEN
      v_agg_pass := p_passing_marks;
    ELSIF p_max_marks IS NOT NULL AND p_passing_marks IS NULL THEN
      -- keep existing aggregate pass (may be NULL)
      v_agg_pass := v_agg_pass;
    END IF;
    IF v_agg_max <= 0 THEN
      RETURN QUERY SELECT 400, 'Max Marks must be greater than 0', NULL::jsonb; RETURN;
    END IF;
    IF v_agg_pass IS NOT NULL AND (v_agg_pass < 0 OR v_agg_pass > v_agg_max) THEN
      RETURN QUERY SELECT 400, 'Passing Marks must be between 0 and total Max Marks', NULL::jsonb; RETURN;
    END IF;
    FOR v_row_es IN
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM examination_subjects WHERE examination_id = p_id AND is_part_b = FALSE
    LOOP
      UPDATE examination_subjects SET
        max_marks = CASE
          WHEN v_row_es.rn = 1 THEN GREATEST(1, v_agg_max - (v_cnt - 1) * (v_agg_max / v_cnt))
          ELSE GREATEST(1, v_agg_max / v_cnt)
        END,
        passing_marks = CASE
          WHEN v_agg_pass IS NULL THEN NULL
          WHEN v_row_es.rn = 1 THEN GREATEST(0, v_agg_pass - (v_cnt - 1) * (v_agg_pass / NULLIF(v_cnt, 0)))
          ELSE GREATEST(0, v_agg_pass / NULLIF(v_cnt, 0))
        END
      WHERE id = v_row_es.id;
    END LOOP;
    v_max_final := v_agg_max;
    v_pass_final := v_agg_pass;
  ELSE
    v_max_final := COALESCE(p_max_marks, v_max_final);
    v_pass_final := COALESCE(p_passing_marks, v_pass_final);
  END IF;

  -- Only compare end > start when BOTH non-null
  IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end <= v_start THEN
    RETURN QUERY SELECT 400, 'End Time must be greater than Start Time', NULL::jsonb; RETURN;
  END IF;
  IF v_max_final <= 0 THEN
    RETURN QUERY SELECT 400, 'Max Marks must be greater than 0', NULL::jsonb; RETURN;
  END IF;
  IF v_pass_final IS NOT NULL AND (v_pass_final < 0 OR v_pass_final > v_max_final) THEN
    RETURN QUERY SELECT 400, 'Passing Marks must be less than or equal to Max Marks', NULL::jsonb; RETURN;
  END IF;

  -- Duplicate prevention for targeted sections (ignore cancelled)
  IF v_is_all_sections THEN
    IF EXISTS (
      SELECT 1
      FROM examinations e
      WHERE e.id <> p_id
        AND e.class_id = v_class
        AND e.exam_date = v_exam_date
        AND (v_start IS NULL OR e.start_time = v_start)
        AND (v_end IS NULL OR e.end_time = v_end)
        AND e.exam_type_id = v_exam_type_id
        AND e.exam_status <> 'cancelled'
    ) THEN
      RETURN QUERY SELECT 409, 'An examination already exists for this section and time', NULL::jsonb; RETURN;
    END IF;
  ELSIF v_section_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM examinations e
      WHERE e.id <> p_id
        AND e.class_id = v_class
        AND e.exam_date = v_exam_date
        AND (v_start IS NULL OR e.start_time = v_start)
        AND (v_end IS NULL OR e.end_time = v_end)
        AND e.exam_type_id = v_exam_type_id
        AND e.exam_status <> 'cancelled'
        AND (
          e.section_id = v_section_id
          OR EXISTS (SELECT 1 FROM examination_sections es WHERE es.examination_id = e.id AND es.section_id = v_section_id)
          OR (e.section_id IS NULL AND NOT EXISTS (SELECT 1 FROM examination_sections es2 WHERE es2.examination_id = e.id))
        )
    ) THEN
      RETURN QUERY SELECT 409, 'An examination already exists for this section and time', NULL::jsonb; RETURN;
    END IF;
  ELSE
    FOREACH v_sid IN ARRAY v_section_ids LOOP
      IF EXISTS (
        SELECT 1
        FROM examinations e
        WHERE e.id <> p_id
          AND e.class_id = v_class
          AND e.exam_date = v_exam_date
          AND (v_start IS NULL OR e.start_time = v_start)
          AND (v_end IS NULL OR e.end_time = v_end)
          AND e.exam_type_id = v_exam_type_id
          AND e.exam_status <> 'cancelled'
          AND (
            e.section_id = v_sid
            OR EXISTS (SELECT 1 FROM examination_sections es WHERE es.examination_id = e.id AND es.section_id = v_sid)
            OR (e.section_id IS NULL AND NOT EXISTS (SELECT 1 FROM examination_sections es2 WHERE es2.examination_id = e.id))
          )
      ) THEN
        RETURN QUERY SELECT 409, 'An examination already exists for this section and time', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  END IF;

  UPDATE examinations
  SET
    test_name = COALESCE(NULLIF(BTRIM(p_test_name), ''), test_name),
    exam_type_id = v_exam_type_id,
    exam_status = COALESCE(p_exam_status, exam_status),
    class_id = COALESCE(p_class_id, class_id),
    section_id = v_section_id,
    exam_date = v_exam_date,
    start_time = v_start,
    end_time = v_end,
    max_marks = v_max_final,
    passing_marks = v_pass_final,
    invigilator = COALESCE(NULLIF(BTRIM(p_invigilator), ''), invigilator),
    instructions = p_instructions,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_id;

  -- Sync join table to desired state.
  DELETE FROM examination_sections WHERE examination_id = p_id;
  IF (NOT v_is_all_sections) AND v_section_id IS NULL AND COALESCE(array_length(v_section_ids, 1), 0) > 0 THEN
    INSERT INTO examination_sections (examination_id, section_id)
    SELECT p_id, sid
    FROM unnest(v_section_ids) AS sid;
  END IF;

  RETURN QUERY SELECT 200, 'Examination updated successfully', jsonb_build_object('id', p_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;


CREATE OR REPLACE FUNCTION public.atr_cancel_examination(
  p_id uuid,
  p_updated_by uuid DEFAULT NULL::uuid
)
RETURNS TABLE(status_code integer, message text, data jsonb)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_status VARCHAR;
  v_deleted INT := 0;
BEGIN
  SELECT exam_status INTO v_current_status
  FROM examinations WHERE id = p_id FOR UPDATE;

  IF v_current_status IS NULL THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;

  IF v_current_status = 'cancelled' THEN
    RETURN QUERY SELECT 200, 'Examination already cancelled', jsonb_build_object('id', p_id); RETURN;
  END IF;

  UPDATE examinations
  SET
    exam_status = 'cancelled',
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_id;

  DELETE FROM examination_results WHERE examination_id = p_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT 200,
    'Examination cancelled and marks deleted',
    jsonb_build_object('id', p_id, 'deleted_results', v_deleted);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;
