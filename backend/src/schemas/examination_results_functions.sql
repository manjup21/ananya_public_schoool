-- ============================================================
-- EXAMINATION RESULTS FUNCTIONS (ATR-style procedures)
-- - Save / fetch marks per student per exam (per subject)
-- - List results for an exam
-- - Student performance summary for dashboards
--
-- Transaction safety:
-- Each function call is atomic. If any statement fails, PostgreSQL rolls back the whole call.
-- Concurrent lecturers:
-- atr_save_student_exam_result merges by subject — empty/omitted subjects are not wiped.
-- ============================================================

DROP FUNCTION IF EXISTS public.atr_save_student_exam_result(UUID, UUID, UUID[], INT[], BOOLEAN[], TEXT[], UUID);
DROP FUNCTION IF EXISTS public.atr_save_student_exam_result(UUID, UUID, UUID[], INT[], BOOLEAN[], TEXT[], UUID, UUID[], TEXT[]);

CREATE OR REPLACE FUNCTION public.atr_save_student_exam_result(
  p_examination_id UUID,
  p_student_id UUID,
  p_subject_ids UUID[],
  p_marks INT[] DEFAULT NULL,
  p_is_absent BOOLEAN[] DEFAULT NULL,
  p_remarks TEXT[] DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_part_b_subject_ids UUID[] DEFAULT NULL,
  p_part_b_grades TEXT[] DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id UUID;
  v_existing_status VARCHAR;
  v_n INT;
  v_i INT;
  v_total INT := 0;
  v_exam_class UUID;
  v_exam_section UUID;
  v_student_class UUID;
  v_student_section UUID;
  v_subject_count INT;
  v_max_marks INT;
  v_part_b_n INT := 0;
  v_grade TEXT;
  v_is_part_b BOOLEAN;
BEGIN
  IF p_examination_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Examination id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Student id is required', NULL::jsonb; RETURN;
  END IF;

  v_n := COALESCE(array_length(p_subject_ids, 1), 0);
  v_part_b_n := COALESCE(array_length(p_part_b_subject_ids, 1), 0);
  IF v_n < 1 AND v_part_b_n < 1 THEN
    RETURN QUERY SELECT 400, 'At least one Part A subject or Part B grade is required', NULL::jsonb; RETURN;
  END IF;

  -- This function is for saving marks (draft edits). Status changes happen via submit/publish functions.

  -- Validate arrays lengths if provided
  IF v_n > 0 THEN
    IF p_marks IS NOT NULL AND array_length(p_marks, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'marks array length must match subject_ids length', NULL::jsonb; RETURN;
    END IF;
    IF p_is_absent IS NOT NULL AND array_length(p_is_absent, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'is_absent array length must match subject_ids length', NULL::jsonb; RETURN;
    END IF;
    IF p_remarks IS NOT NULL AND array_length(p_remarks, 1) IS DISTINCT FROM v_n THEN
      RETURN QUERY SELECT 400, 'remarks array length must match subject_ids length', NULL::jsonb; RETURN;
    END IF;
  END IF;

  IF v_part_b_n > 0 THEN
    IF p_part_b_grades IS NULL OR array_length(p_part_b_grades, 1) IS DISTINCT FROM v_part_b_n THEN
      RETURN QUERY SELECT 400, 'part_b_grades array length must match part_b_subject_ids length', NULL::jsonb; RETURN;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM examinations WHERE id = p_examination_id) THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;

  -- Ensure student belongs to exam class/section
  SELECT class_id, section_id INTO v_exam_class, v_exam_section
  FROM examinations
  WHERE id = p_examination_id;

  SELECT class_id, section_id INTO v_student_class, v_student_section
  FROM students
  WHERE id = p_student_id;

  IF v_student_class IS DISTINCT FROM v_exam_class THEN
    RETURN QUERY SELECT 400, 'Student does not belong to the examination class', NULL::jsonb; RETURN;
  END IF;

  IF v_exam_section IS NOT NULL THEN
    IF v_student_section IS DISTINCT FROM v_exam_section THEN
      RETURN QUERY SELECT 400, 'Student does not belong to the examination section', NULL::jsonb; RETURN;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM examination_sections WHERE examination_id = p_examination_id LIMIT 1) THEN
      IF v_student_section IS NULL OR NOT EXISTS (
        SELECT 1 FROM examination_sections
        WHERE examination_id = p_examination_id AND section_id = v_student_section
      ) THEN
        RETURN QUERY SELECT 400, 'Student section is not included in this examination', NULL::jsonb; RETURN;
      END IF;
    END IF;
  END IF;

  -- Ensure Part A subjects belong to this examination (Part A only)
  IF v_n > 0 THEN
    SELECT COUNT(*) INTO v_subject_count
    FROM examination_subjects es
    WHERE es.examination_id = p_examination_id
      AND es.is_part_b = FALSE
      AND es.subject_id = ANY (p_subject_ids);
    IF v_subject_count <> v_n THEN
      RETURN QUERY SELECT 400, 'One or more subjects are not part of this examination (Part A)', NULL::jsonb; RETURN;
    END IF;
  END IF;

  IF v_part_b_n > 0 THEN
    SELECT COUNT(*) INTO v_subject_count
    FROM examination_subjects es
    WHERE es.examination_id = p_examination_id
      AND es.is_part_b = TRUE
      AND es.subject_id = ANY (p_part_b_subject_ids);
    IF v_subject_count <> v_part_b_n THEN
      RETURN QUERY SELECT 400, 'One or more subjects are not Part B subjects for this examination', NULL::jsonb; RETURN;
    END IF;
  END IF;

  -- Upsert result row (always keep as draft while editing)
  INSERT INTO examination_results (id, examination_id, student_id, total_marks, result_status, created_by, updated_by)
  VALUES (uuid_generate_v4(), p_examination_id, p_student_id, NULL, 'draft', p_actor_user_id, p_actor_user_id)
  ON CONFLICT (examination_id, student_id)
  DO UPDATE SET
    updated_by = p_actor_user_id,
    updated_at = NOW()
  RETURNING id, result_status INTO v_result_id, v_existing_status;

  -- Concurrency safety: lock the result row for the rest of this function call.
  PERFORM 1 FROM examination_results WHERE id = v_result_id FOR UPDATE;

  IF v_existing_status IN ('submitted', 'published') THEN
    RETURN QUERY SELECT 403, 'Result is locked (already submitted/published)', NULL::jsonb; RETURN;
  END IF;

  -- Part A marks merge
  IF v_n > 0 THEN
    FOR v_i IN 1..v_n LOOP
      IF p_is_absent IS NOT NULL AND p_is_absent[v_i] = TRUE THEN
        IF p_marks IS NOT NULL AND p_marks[v_i] IS NOT NULL THEN
          RETURN QUERY SELECT 400, 'Absent subjects must not have a mark value', NULL::jsonb; RETURN;
        END IF;
        INSERT INTO examination_result_marks (id, result_id, subject_id, mark, is_absent, remarks, grade_text, updated_at)
        VALUES (
          uuid_generate_v4(),
          v_result_id,
          p_subject_ids[v_i],
          NULL,
          TRUE,
          CASE WHEN p_remarks IS NULL THEN NULL ELSE NULLIF(BTRIM(p_remarks[v_i]), '') END,
          NULL,
          NOW()
        )
        ON CONFLICT (result_id, subject_id)
        DO UPDATE SET
          mark = NULL,
          is_absent = TRUE,
          remarks = EXCLUDED.remarks,
          grade_text = NULL,
          updated_at = NOW();
      ELSE
        IF p_marks IS NULL OR p_marks[v_i] IS NULL THEN
          CONTINUE;
        END IF;

        SELECT es.max_marks, es.is_part_b INTO v_max_marks, v_is_part_b
        FROM examination_subjects es
        WHERE es.examination_id = p_examination_id AND es.subject_id = p_subject_ids[v_i];

        IF v_is_part_b THEN
          RETURN QUERY SELECT 400, 'Cannot save numeric marks for Part B subjects', NULL::jsonb; RETURN;
        END IF;

        IF v_max_marks IS NOT NULL AND p_marks[v_i] > v_max_marks THEN
          RETURN QUERY SELECT 400, 'Mark cannot exceed subject max marks', NULL::jsonb; RETURN;
        END IF;

        INSERT INTO examination_result_marks (id, result_id, subject_id, mark, is_absent, remarks, grade_text, updated_at)
        VALUES (
          uuid_generate_v4(),
          v_result_id,
          p_subject_ids[v_i],
          p_marks[v_i],
          FALSE,
          CASE WHEN p_remarks IS NULL THEN NULL ELSE NULLIF(BTRIM(p_remarks[v_i]), '') END,
          NULL,
          NOW()
        )
        ON CONFLICT (result_id, subject_id)
        DO UPDATE SET
          mark = EXCLUDED.mark,
          is_absent = FALSE,
          remarks = EXCLUDED.remarks,
          grade_text = NULL,
          updated_at = NOW();
      END IF;
    END LOOP;
  END IF;

  -- Part B free-text grades merge (empty string = skip / leave existing)
  IF v_part_b_n > 0 THEN
    FOR v_i IN 1..v_part_b_n LOOP
      v_grade := NULLIF(BTRIM(COALESCE(p_part_b_grades[v_i], '')), '');
      IF v_grade IS NULL THEN
        CONTINUE;
      END IF;
      IF LENGTH(v_grade) > 50 THEN
        RETURN QUERY SELECT 400, 'Part B grade is invalid', NULL::jsonb; RETURN;
      END IF;

      INSERT INTO examination_result_marks (id, result_id, subject_id, mark, is_absent, remarks, grade_text, updated_at)
      VALUES (
        uuid_generate_v4(),
        v_result_id,
        p_part_b_subject_ids[v_i],
        NULL,
        FALSE,
        NULL,
        v_grade,
        NOW()
      )
      ON CONFLICT (result_id, subject_id)
      DO UPDATE SET
        mark = NULL,
        is_absent = FALSE,
        grade_text = EXCLUDED.grade_text,
        updated_at = NOW();
    END LOOP;
  END IF;

  -- Total from Part A numeric marks only
  SELECT COALESCE(SUM(m.mark), 0)::INT INTO v_total
  FROM examination_result_marks m
  JOIN examination_subjects es
    ON es.examination_id = p_examination_id AND es.subject_id = m.subject_id
  WHERE m.result_id = v_result_id
    AND es.is_part_b = FALSE
    AND m.is_absent = FALSE
    AND m.mark IS NOT NULL;

  UPDATE examination_results
  SET total_marks = v_total, result_status = 'draft', updated_by = p_actor_user_id, updated_at = NOW()
  WHERE id = v_result_id;

  RETURN QUERY
  SELECT 200,
         'Result saved successfully',
         jsonb_build_object('result_id', v_result_id, 'result_status', 'draft');
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 409, 'Duplicate result', NULL::jsonb; RETURN;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


-- Move a result from draft -> submitted (locks edits)
CREATE OR REPLACE FUNCTION public.atr_submit_student_exam_result(
  p_examination_id UUID,
  p_student_id UUID,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id UUID;
  v_status VARCHAR;
BEGIN
  IF p_examination_id IS NULL OR p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'examination_id and student_id are required', NULL::jsonb; RETURN;
  END IF;

  SELECT id, result_status INTO v_result_id, v_status
  FROM examination_results
  WHERE examination_id = p_examination_id AND student_id = p_student_id;

  IF v_result_id IS NULL THEN
    RETURN QUERY SELECT 404, 'Result not found', NULL::jsonb; RETURN;
  END IF;

  PERFORM 1 FROM examination_results WHERE id = v_result_id FOR UPDATE;

  IF v_status = 'published' THEN
    RETURN QUERY SELECT 409, 'Result is already published', NULL::jsonb; RETURN;
  END IF;
  IF v_status = 'submitted' THEN
    RETURN QUERY SELECT 200, 'Result already submitted', jsonb_build_object('result_id', v_result_id, 'result_status', 'submitted'); RETURN;
  END IF;

  -- Optional completeness check could be added here (all subjects filled/absent).
  UPDATE examination_results
  SET result_status = 'submitted', updated_by = p_actor_user_id, updated_at = NOW()
  WHERE id = v_result_id;

  RETURN QUERY SELECT 200, 'Result submitted successfully', jsonb_build_object('result_id', v_result_id, 'result_status', 'submitted');
END;
$$;


-- Move a result from submitted -> published (final)
CREATE OR REPLACE FUNCTION public.atr_publish_student_exam_result(
  p_examination_id UUID,
  p_student_id UUID,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id UUID;
  v_status VARCHAR;
BEGIN
  IF p_examination_id IS NULL OR p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'examination_id and student_id are required', NULL::jsonb; RETURN;
  END IF;

  SELECT id, result_status INTO v_result_id, v_status
  FROM examination_results
  WHERE examination_id = p_examination_id AND student_id = p_student_id;

  IF v_result_id IS NULL THEN
    RETURN QUERY SELECT 404, 'Result not found', NULL::jsonb; RETURN;
  END IF;

  PERFORM 1 FROM examination_results WHERE id = v_result_id FOR UPDATE;

  IF v_status = 'published' THEN
    RETURN QUERY SELECT 200, 'Result already published', jsonb_build_object('result_id', v_result_id, 'result_status', 'published'); RETURN;
  END IF;
  IF v_status <> 'submitted' THEN
    RETURN QUERY SELECT 409, 'Result must be submitted before publishing', NULL::jsonb; RETURN;
  END IF;

  UPDATE examination_results
  SET result_status = 'published', updated_by = p_actor_user_id, updated_at = NOW()
  WHERE id = v_result_id;

  RETURN QUERY SELECT 200, 'Result published successfully', jsonb_build_object('result_id', v_result_id, 'result_status', 'published');
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_get_student_exam_result(
  p_examination_id UUID,
  p_student_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id UUID;
BEGIN
  IF p_examination_id IS NULL OR p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'examination_id and student_id are required', NULL::jsonb; RETURN;
  END IF;

  SELECT id INTO v_result_id
  FROM examination_results
  WHERE examination_id = p_examination_id AND student_id = p_student_id;

  IF v_result_id IS NULL THEN
    RETURN QUERY SELECT 404, 'Result not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Result fetched successfully',
    jsonb_build_object(
      'result', to_jsonb(r),
      'marks', COALESCE(
        (SELECT jsonb_agg(
           jsonb_build_object(
             'subject_id', m.subject_id,
             'mark', m.mark,
             'is_absent', m.is_absent,
             'remarks', m.remarks,
             'grade_text', m.grade_text,
             'is_part_b', es.is_part_b
           )
           ORDER BY es.is_part_b ASC, sub.sort_order, sub.name
         )
         FROM examination_result_marks m
         JOIN examination_results rr ON rr.id = m.result_id
         JOIN examination_subjects es ON es.examination_id = rr.examination_id AND es.subject_id = m.subject_id
         JOIN subjects sub ON sub.id = m.subject_id
         WHERE m.result_id = r.id),
        '[]'::jsonb
      )
    )
  FROM examination_results r
  WHERE r.id = v_result_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_list_exam_results(
  p_examination_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_examination_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Examination id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM examinations WHERE id = p_examination_id) THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;
  IF p_status IS NOT NULL AND BTRIM(p_status) <> '' AND p_status NOT IN ('draft','submitted','published') THEN
    RETURN QUERY SELECT 400, 'status must be one of: draft, submitted, published', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Results fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.roll_number, x.student_name), '[]'::jsonb)
  FROM (
    SELECT
      r.id AS result_id,
      r.examination_id,
      r.student_id,
      s.roll_number,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      r.total_marks,
      r.result_status,
      r.updated_at
    FROM examination_results r
    JOIN students s ON s.id = r.student_id
    WHERE r.examination_id = p_examination_id
      AND (p_status IS NULL OR BTRIM(p_status) = '' OR r.result_status = p_status)
      AND (
        p_search IS NULL OR BTRIM(p_search) = '' OR
        LOWER(s.roll_number) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(COALESCE(s.first_name, '')) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(COALESCE(s.last_name, '')) LIKE '%' || LOWER(BTRIM(p_search)) || '%'
      )
  ) x;
END;
$$;


-- Bulk helper for view/export screens:
-- returns exam metadata + subject list + all saved results with subject-wise marks.
CREATE OR REPLACE FUNCTION public.atr_get_exam_results_full(
  p_examination_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_exam JSONB;
  v_subjects JSONB;
BEGIN
  IF p_examination_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Examination id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM examinations WHERE id = p_examination_id) THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;
  IF p_status IS NOT NULL AND BTRIM(p_status) <> '' AND p_status NOT IN ('draft','submitted','published') THEN
    RETURN QUERY SELECT 400, 'status must be one of: draft, submitted, published', NULL::jsonb; RETURN;
  END IF;

  SELECT to_jsonb(e) INTO v_exam
  FROM examinations e
  WHERE e.id = p_examination_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'max_marks', es.max_marks,
        'passing_marks', es.passing_marks,
        'is_part_b', es.is_part_b
      )
      ORDER BY es.is_part_b ASC, s.sort_order, s.name
    ),
    '[]'::jsonb
  )
  INTO v_subjects
  FROM examination_subjects es
  JOIN subjects s ON s.id = es.subject_id
  WHERE es.examination_id = p_examination_id;

  RETURN QUERY
  SELECT
    200,
    'Results fetched successfully',
    jsonb_build_object(
      'exam', COALESCE(v_exam, '{}'::jsonb),
      'subjects', v_subjects,
      'results', COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.roll_number, x.student_name), '[]'::jsonb)
    )
  FROM (
    SELECT
      r.id AS result_id,
      r.examination_id,
      r.student_id,
      s.roll_number,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      r.total_marks,
      r.result_status,
      r.updated_at,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'subject_id', es2.subject_id,
              'mark', m.mark,
              'is_absent', COALESCE(m.is_absent, FALSE),
              'remarks', m.remarks,
              'grade_text', m.grade_text,
              'is_part_b', es2.is_part_b
            )
            ORDER BY es2.is_part_b ASC, sub2.sort_order, sub2.name
          )
          FROM examination_subjects es2
          JOIN subjects sub2 ON sub2.id = es2.subject_id
          LEFT JOIN examination_result_marks m
            ON m.result_id = r.id AND m.subject_id = es2.subject_id
          WHERE es2.examination_id = p_examination_id
        ),
        '[]'::jsonb
      ) AS marks
    FROM examination_results r
    JOIN students s ON s.id = r.student_id
    WHERE r.examination_id = p_examination_id
      AND (p_status IS NULL OR BTRIM(p_status) = '' OR r.result_status = p_status)
      AND (
        p_search IS NULL OR BTRIM(p_search) = '' OR
        LOWER(s.roll_number) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(COALESCE(s.first_name, '')) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(COALESCE(s.last_name, '')) LIKE '%' || LOWER(BTRIM(p_search)) || '%'
      )
  ) x;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_delete_student_exam_result(
  p_result_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_result_id IS NULL THEN
    RETURN QUERY SELECT 400, 'result_id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM examination_results WHERE id = p_result_id) THEN
    RETURN QUERY SELECT 404, 'Result not found', NULL::jsonb; RETURN;
  END IF;

  DELETE FROM examination_results WHERE id = p_result_id;
  RETURN QUERY SELECT 200, 'Result deleted successfully', jsonb_build_object('id', p_result_id);
END;
$$;


-- Student dashboard helper: paginated results + chart series + aggregates (optional date/type/subject filters).
-- With p_subject_id, total/max/passing marks are that subject's Part A values; absent rows have total_marks NULL.
DROP FUNCTION IF EXISTS public.atr_get_student_performance_summary(uuid, int, int, date, date, uuid, int);
CREATE OR REPLACE FUNCTION public.atr_get_student_performance_summary(
  p_student_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_exam_type_id UUID DEFAULT NULL,
  p_chart_limit INT DEFAULT 50,
  p_subject_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_chart_cap INT;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RETURN QUERY SELECT 400, 'limit must be between 1 and 200', NULL::jsonb; RETURN;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RETURN QUERY SELECT 400, 'offset must be >= 0', NULL::jsonb; RETURN;
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RETURN QUERY SELECT 400, 'from date must be on or before to date', NULL::jsonb; RETURN;
  END IF;
  IF p_exam_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM exam_types WHERE id = p_exam_type_id) THEN
    RETURN QUERY SELECT 400, 'exam_type_id not found', NULL::jsonb; RETURN;
  END IF;
  IF p_subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM subjects WHERE id = p_subject_id) THEN
    RETURN QUERY SELECT 400, 'subject_id not found', NULL::jsonb; RETURN;
  END IF;
  v_chart_cap := LEAST(GREATEST(COALESCE(p_chart_limit, 50), 1), 200);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      r.id AS result_id,
      r.student_id,
      CASE WHEN p_subject_id IS NULL THEN r.total_marks ELSE sm.mark END AS total_marks,
      COALESCE(sm.is_absent, FALSE) AS is_absent,
      r.result_status,
      r.updated_at,
      e.id AS examination_id,
      e.test_name,
      et.id AS exam_type_id,
      et.name AS exam_type,
      e.exam_status,
      e.exam_date,
      CASE WHEN p_subject_id IS NULL THEN e.max_marks ELSE es.max_marks END AS max_marks,
      CASE WHEN p_subject_id IS NULL THEN e.passing_marks ELSE es.passing_marks END AS passing_marks,
      e.class_id,
      e.section_id
    FROM examination_results r
    JOIN examinations e ON e.id = r.examination_id
    JOIN exam_types et ON et.id = e.exam_type_id
    LEFT JOIN examination_subjects es
      ON es.examination_id = e.id AND es.subject_id = p_subject_id AND es.is_part_b = FALSE
    LEFT JOIN examination_result_marks sm
      ON sm.result_id = r.id AND sm.subject_id = p_subject_id
    WHERE r.student_id = p_student_id
      AND e.exam_status = 'completed'
      AND (p_from IS NULL OR e.exam_date >= p_from)
      AND (p_to IS NULL OR e.exam_date <= p_to)
      AND (p_exam_type_id IS NULL OR e.exam_type_id = p_exam_type_id)
      AND (p_subject_id IS NULL OR es.id IS NOT NULL)
  ),
  page_rows AS (
    SELECT * FROM filtered
    ORDER BY exam_date DESC, updated_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  chart_recent AS (
    SELECT * FROM filtered
    ORDER BY exam_date DESC, updated_at DESC
    LIMIT v_chart_cap
  )
  SELECT
    200,
    'Student performance fetched successfully',
    jsonb_build_object(
      'exams', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.exam_date DESC, p.updated_at DESC) FROM page_rows p), '[]'::jsonb),
      'total', (SELECT COUNT(*)::bigint FROM filtered),
      'chartSeries', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.exam_date ASC, c.updated_at ASC) FROM chart_recent c), '[]'::jsonb),
      'avgPct', (
        SELECT ROUND(AVG((f.total_marks::numeric / NULLIF(f.max_marks, 0)) * 100)::numeric, 2)
        FROM filtered f
        WHERE f.max_marks > 0 AND f.total_marks IS NOT NULL
      ),
      'chartLimit', to_jsonb(v_chart_cap)
    );
END;
$$;


-- Staff student progress report PDF: subject-wise marks grouped by exam type (max 8 completed exams per type)
CREATE OR REPLACE FUNCTION public.atr_get_student_progress_report(
  p_student_id UUID,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_exam_type_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sections JSONB := '[]'::jsonb;
  v_type RECORD;
  v_exam RECORD;
  v_subjects JSONB;
  v_exams JSONB;
  v_marks JSONB;
  v_part_b_grades JSONB;
  v_part_b_subjects JSONB;
  v_max_by_subject JSONB;
  v_section JSONB;
  v_idx INT;
  v_exam_ids UUID[];
  v_rank INT;
  v_total_students INT;
  v_student_absent BOOLEAN;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RETURN QUERY SELECT 400, 'from date must be on or before to date', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;
  IF p_exam_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM exam_types WHERE id = p_exam_type_id) THEN
    RETURN QUERY SELECT 400, 'exam_type_id not found', NULL::jsonb; RETURN;
  END IF;

  FOR v_type IN
    SELECT et.id AS exam_type_id, et.name AS exam_type_name
    FROM examination_results r
    JOIN examinations e ON e.id = r.examination_id
    JOIN exam_types et ON et.id = e.exam_type_id
    WHERE r.student_id = p_student_id
      AND e.exam_status = 'completed'
      AND (p_from IS NULL OR e.exam_date >= p_from)
      AND (p_to IS NULL OR e.exam_date <= p_to)
      AND (p_exam_type_id IS NULL OR e.exam_type_id = p_exam_type_id)
    GROUP BY et.id, et.name, et.is_system, et.sort_order
    ORDER BY CASE WHEN et.is_system THEN 1 ELSE 0 END, et.sort_order, et.name
  LOOP
    SELECT COALESCE(array_agg(sub.examination_id ORDER BY sub.exam_date DESC), ARRAY[]::uuid[])
    INTO v_exam_ids
    FROM (
      SELECT e.id AS examination_id, e.exam_date
      FROM examination_results r
      JOIN examinations e ON e.id = r.examination_id
      WHERE r.student_id = p_student_id
        AND e.exam_status = 'completed'
        AND e.exam_type_id = v_type.exam_type_id
        AND (p_from IS NULL OR e.exam_date >= p_from)
        AND (p_to IS NULL OR e.exam_date <= p_to)
      ORDER BY e.exam_date DESC
      LIMIT 8
    ) sub;

    IF COALESCE(array_length(v_exam_ids, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', s.subject_id,
          'name', subj.name,
          'maxMarks', s.max_marks
        )
        ORDER BY subj.sort_order, subj.name
      ),
      '[]'::jsonb
    )
    INTO v_subjects
    FROM (
      SELECT DISTINCT es.subject_id, MAX(es.max_marks) AS max_marks
      FROM examination_subjects es
      WHERE es.examination_id = ANY(v_exam_ids)
        AND es.is_part_b = FALSE
      GROUP BY es.subject_id
    ) s
    JOIN subjects subj ON subj.id = s.subject_id;

    v_exams := '[]'::jsonb;
    v_idx := 0;
    FOR v_exam IN
      SELECT e.id AS examination_id, e.exam_date, e.test_name, r.total_marks, e.max_marks AS exam_max_marks
      FROM examination_results r
      JOIN examinations e ON e.id = r.examination_id
      WHERE r.student_id = p_student_id
        AND e.id = ANY(v_exam_ids)
      ORDER BY e.exam_date ASC
    LOOP
      v_idx := v_idx + 1;

      SELECT COALESCE(
        jsonb_object_agg(
          m.subject_id::text,
          CASE
            WHEN m.is_absent THEN to_jsonb('Ab'::text)
            WHEN m.mark IS NOT NULL THEN to_jsonb(m.mark)
            ELSE 'null'::jsonb
          END
        ),
        '{}'::jsonb
      )
      INTO v_marks
      FROM examination_result_marks m
      JOIN examination_subjects esx
        ON esx.examination_id = v_exam.examination_id
       AND esx.subject_id = m.subject_id
       AND esx.is_part_b = FALSE
      WHERE m.result_id = (
        SELECT r2.id FROM examination_results r2
        WHERE r2.examination_id = v_exam.examination_id AND r2.student_id = p_student_id
        LIMIT 1
      );

      SELECT COALESCE(
        jsonb_object_agg(m.subject_id::text, to_jsonb(COALESCE(m.grade_text, ''))),
        '{}'::jsonb
      )
      INTO v_part_b_grades
      FROM examination_result_marks m
      JOIN examination_subjects esb
        ON esb.examination_id = v_exam.examination_id
       AND esb.subject_id = m.subject_id
       AND esb.is_part_b = TRUE
      WHERE m.result_id = (
        SELECT r2.id FROM examination_results r2
        WHERE r2.examination_id = v_exam.examination_id AND r2.student_id = p_student_id
        LIMIT 1
      );

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('id', s.id, 'name', s.name)
          ORDER BY s.name
        ),
        '[]'::jsonb
      )
      INTO v_part_b_subjects
      FROM examination_subjects es
      JOIN subjects s ON s.id = es.subject_id
      WHERE es.examination_id = v_exam.examination_id
        AND es.is_part_b = TRUE;

      SELECT COALESCE(
        jsonb_object_agg(es.subject_id::text, to_jsonb(es.max_marks)),
        '{}'::jsonb
      )
      INTO v_max_by_subject
      FROM examination_subjects es
      WHERE es.examination_id = v_exam.examination_id
        AND es.is_part_b = FALSE;

      v_rank := NULL;
      v_total_students := 0;
      v_student_absent := FALSE;

      SELECT COUNT(*)::int
      INTO v_total_students
      FROM examination_results
      WHERE examination_id = v_exam.examination_id;

      SELECT EXISTS (
        SELECT 1
        FROM examination_result_marks m
        JOIN examination_results r2 ON r2.id = m.result_id
        JOIN examination_subjects esab
          ON esab.examination_id = v_exam.examination_id
         AND esab.subject_id = m.subject_id
         AND esab.is_part_b = FALSE
        WHERE r2.examination_id = v_exam.examination_id
          AND r2.student_id = p_student_id
          AND m.is_absent = TRUE
      )
      INTO v_student_absent;

      IF NOT v_student_absent THEN
        SELECT sub.rk
        INTO v_rank
        FROM (
          SELECT
            r.student_id,
            DENSE_RANK() OVER (
              ORDER BY r.total_marks DESC NULLS LAST, s.roll_number ASC NULLS LAST
            ) AS rk
          FROM examination_results r
          JOIN students s ON s.id = r.student_id
          WHERE r.examination_id = v_exam.examination_id
            AND r.total_marks IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM examination_result_marks m
              JOIN examination_subjects esa
                ON esa.examination_id = v_exam.examination_id
               AND esa.subject_id = m.subject_id
               AND esa.is_part_b = FALSE
              WHERE m.result_id = r.id AND m.is_absent = TRUE
            )
        ) sub
        WHERE sub.student_id = p_student_id;
      END IF;

      v_exams := v_exams || jsonb_build_array(
        jsonb_build_object(
          'examinationId', v_exam.examination_id,
          'testLabel', COALESCE(NULLIF(BTRIM(v_exam.test_name), ''), 'Test -' || LPAD(v_idx::text, 2, '0')),
          'testName', COALESCE(NULLIF(BTRIM(v_exam.test_name), ''), 'Test -' || LPAD(v_idx::text, 2, '0')),
          'examDate', v_exam.exam_date,
          'marksBySubjectId', COALESCE(v_marks, '{}'::jsonb),
          'maxMarksBySubjectId', COALESCE(v_max_by_subject, '{}'::jsonb),
          'partBSubjects', COALESCE(v_part_b_subjects, '[]'::jsonb),
          'partBGradesBySubjectId', COALESCE(v_part_b_grades, '{}'::jsonb),
          'total', v_exam.total_marks,
          'maxTotal', v_exam.exam_max_marks,
          'rank', v_rank,
          'totalStudents', v_total_students
        )
      );
    END LOOP;

    v_section := jsonb_build_object(
      'examTypeId', v_type.exam_type_id,
      'examTypeName', v_type.exam_type_name,
      'subjects', COALESCE(v_subjects, '[]'::jsonb),
      'exams', v_exams
    );
    v_sections := v_sections || jsonb_build_array(v_section);
  END LOOP;

  RETURN QUERY SELECT 200, 'Student progress report fetched successfully', jsonb_build_object('sections', v_sections);
END;
$$;

