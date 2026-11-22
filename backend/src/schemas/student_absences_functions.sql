-- ============================================================
-- STUDENT ABSENCES FUNCTIONS (ATR-style procedures)
-- - Absences-only attendance storage (per date + slot_index)
-- - Summary calculation using attendance patterns
--
-- Transaction safety:
-- Each function call is atomic. If any statement fails, PostgreSQL rolls back the whole call.
-- ============================================================

CREATE OR REPLACE FUNCTION public.atr_mark_student_absent(
  p_student_id UUID,
  p_absent_date DATE,
  p_slot_index INT DEFAULT 1,
  p_reason TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_absent_date IS NULL THEN
    RETURN QUERY SELECT 400, 'absent_date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;

  INSERT INTO student_absences (id, student_id, absent_date, slot_index, reason, created_by)
  VALUES (
    uuid_generate_v4(),
    p_student_id,
    p_absent_date,
    p_slot_index,
    NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
    p_actor_user_id
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 201, 'Absence marked successfully', jsonb_build_object('id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 409, 'Absence already recorded for this student, date, and slot', NULL::jsonb; RETURN;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_unmark_student_absent(
  p_student_id UUID,
  p_absent_date DATE,
  p_slot_index INT DEFAULT 1
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_student_id IS NULL OR p_absent_date IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id and absent_date are required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM student_absences
    WHERE student_id = p_student_id AND absent_date = p_absent_date AND slot_index = p_slot_index
  ) THEN
    RETURN QUERY SELECT 404, 'Absence record not found', NULL::jsonb; RETURN;
  END IF;

  DELETE FROM student_absences
  WHERE student_id = p_student_id AND absent_date = p_absent_date AND slot_index = p_slot_index;
  RETURN QUERY SELECT 200, 'Absence removed successfully',
    jsonb_build_object('student_id', p_student_id, 'absent_date', p_absent_date, 'slot_index', p_slot_index);
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_list_student_absences(
  p_student_id UUID,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_id UUID;
  v_section_id UUID;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;

  SELECT s.class_id, s.section_id INTO v_class_id, v_section_id
  FROM students s WHERE s.id = p_student_id;

  RETURN QUERY
  SELECT
    200,
    'Absences fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.absent_date DESC, x.slot_index), '[]'::jsonb)
  FROM (
    SELECT
      a.id,
      a.student_id,
      a.absent_date,
      a.slot_index,
      COALESCE(
        (
          SELECT ps.slot_name
          FROM attendance_patterns ap
          JOIN attendance_pattern_slots ps
            ON ps.pattern_id = ap.id
            AND ps.slot_index = a.slot_index
            AND (ps.day_of_week IS NULL OR ps.day_of_week = EXTRACT(DOW FROM a.absent_date)::int)
          WHERE ap.is_active = TRUE
            AND a.absent_date BETWEEN ap.start_date AND ap.end_date
            AND (
              (ap.scope = 'section' AND ap.class_id = v_class_id AND ap.section_id = v_section_id)
              OR (ap.scope = 'class' AND ap.class_id = v_class_id AND ap.section_id IS NULL)
              OR (ap.scope = 'global')
            )
          ORDER BY
            CASE ap.scope WHEN 'section' THEN 1 WHEN 'class' THEN 2 ELSE 3 END
          LIMIT 1
        ),
        'Slot ' || a.slot_index
      ) AS slot_name,
      a.reason,
      a.created_by,
      a.created_at
    FROM student_absences a
    WHERE a.student_id = p_student_id
      AND (p_from IS NULL OR a.absent_date >= p_from)
      AND (p_to IS NULL OR a.absent_date <= p_to)
  ) x;
END;
$$;


-- Absences for roster: students absent on a date+slot within a class (optional section filter).
CREATE OR REPLACE FUNCTION public.atr_list_absences_for_roster(
  p_class_id UUID,
  p_section_id UUID,
  p_date DATE,
  p_slot_index INT
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_date IS NULL THEN
    RETURN QUERY SELECT 400, 'date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Roster absences fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.roll_number), '[]'::jsonb)
  FROM (
    SELECT
      a.student_id,
      s.roll_number
    FROM student_absences a
    JOIN students s ON s.id = a.student_id AND s.is_deleted = FALSE
    WHERE a.absent_date = p_date
      AND a.slot_index = p_slot_index
      AND s.class_id = p_class_id
      AND (p_section_id IS NULL OR s.section_id = p_section_id)
  ) x;
END;
$$;


-- Bulk mark absent: validates each student belongs to class (and section if provided).
CREATE OR REPLACE FUNCTION public.atr_mark_students_absent_bulk(
  p_student_ids UUID[],
  p_absent_date DATE,
  p_slot_index INT,
  p_reason TEXT,
  p_actor_user_id UUID,
  p_class_id UUID,
  p_section_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sid UUID;
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_invalid INT := 0;
  v_reason TEXT;
BEGIN
  IF p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 400, 'student_ids is required', NULL::jsonb; RETURN;
  END IF;
  IF p_absent_date IS NULL THEN
    RETURN QUERY SELECT 400, 'absent_date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');

  FOREACH v_sid IN ARRAY p_student_ids
  LOOP
    IF v_sid IS NULL THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = v_sid
        AND s.is_deleted = FALSE
        AND s.class_id = p_class_id
        AND (p_section_id IS NULL OR s.section_id = p_section_id)
    ) THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO student_absences (id, student_id, absent_date, slot_index, reason, created_by)
      VALUES (uuid_generate_v4(), v_sid, p_absent_date, p_slot_index, v_reason, p_actor_user_id);
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT 200, 'Bulk absence processed',
    jsonb_build_object(
      'inserted', v_inserted,
      'skipped_duplicate', v_skipped,
      'invalid_or_out_of_scope', v_invalid
    );
END;
$$;


-- Bulk remove absence rows for the given date and slot (same class/section scope as bulk mark).
CREATE OR REPLACE FUNCTION public.atr_unmark_students_absent_bulk(
  p_student_ids UUID[],
  p_absent_date DATE,
  p_slot_index INT,
  p_class_id UUID,
  p_section_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sid UUID;
  v_removed INT := 0;
  v_not_found INT := 0;
  v_invalid INT := 0;
BEGIN
  IF p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 400, 'student_ids is required', NULL::jsonb; RETURN;
  END IF;
  IF p_absent_date IS NULL THEN
    RETURN QUERY SELECT 400, 'absent_date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;

  FOREACH v_sid IN ARRAY p_student_ids
  LOOP
    IF v_sid IS NULL THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = v_sid
        AND s.is_deleted = FALSE
        AND s.class_id = p_class_id
        AND (p_section_id IS NULL OR s.section_id = p_section_id)
    ) THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    DELETE FROM student_absences a
    WHERE a.student_id = v_sid
      AND a.absent_date = p_absent_date
      AND a.slot_index = p_slot_index;

    IF FOUND THEN
      v_removed := v_removed + 1;
    ELSE
      v_not_found := v_not_found + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT 200, 'Bulk absence removal processed',
    jsonb_build_object(
      'removed', v_removed,
      'not_found', v_not_found,
      'invalid_or_out_of_scope', v_invalid
    );
END;
$$;


-- Attendance summary for dashboards.
-- Computes expected days from patterns, then absent days from student_absences (any slot counts once per day).
CREATE OR REPLACE FUNCTION public.atr_get_student_attendance_summary(
  p_student_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_id UUID;
  v_section_id UUID;
  v_expected_days INT;
  v_absent_days INT;
  v_expected_sessions INT;
  v_absent_sessions INT;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT 400, 'student_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN QUERY SELECT 400, 'from and to dates are required', NULL::jsonb; RETURN;
  END IF;
  IF p_to < p_from THEN
    RETURN QUERY SELECT 400, 'to date must be on or after from date', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND is_deleted = FALSE) THEN
    RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb; RETURN;
  END IF;

  SELECT class_id, section_id INTO v_class_id, v_section_id
  FROM students
  WHERE id = p_student_id;

  -- Expected days: days where a pattern applies and that day_of_week is enabled.
  -- Note: CTEs are scoped to a single SQL statement, so compute expected+absent in one WITH.
  WITH days AS (
    SELECT d::date AS dt
    FROM generate_series(p_from, p_to, interval '1 day') d
    WHERE NOT public.atr_is_institution_holiday(d::date)
  ),
  chosen_pattern AS (
    SELECT
      days.dt,
      -- precedence: section > class > global
      COALESCE(sec.id, cls.id, glb.id) AS pattern_id
    FROM days
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'section'
        AND p.class_id = v_class_id
        AND p.section_id = v_section_id
        AND days.dt BETWEEN p.start_date AND p.end_date
      ORDER BY p.start_date DESC, p.created_at DESC
      LIMIT 1
    ) sec ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'class'
        AND p.class_id = v_class_id
        AND days.dt BETWEEN p.start_date AND p.end_date
      ORDER BY p.start_date DESC, p.created_at DESC
      LIMIT 1
    ) cls ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'global'
        AND days.dt BETWEEN p.start_date AND p.end_date
      ORDER BY p.start_date DESC, p.created_at DESC
      LIMIT 1
    ) glb ON TRUE
  ),
  expected AS (
    SELECT cp.dt
    FROM chosen_pattern cp
    WHERE cp.pattern_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM attendance_pattern_days pd
        WHERE pd.pattern_id = cp.pattern_id
          AND pd.day_of_week = EXTRACT(DOW FROM cp.dt)::int
      )
  ),
  expected_with_pattern AS (
    SELECT
      cp.dt,
      cp.pattern_id
    FROM chosen_pattern cp
    WHERE cp.pattern_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM attendance_pattern_days pd
        WHERE pd.pattern_id = cp.pattern_id
          AND pd.day_of_week = EXTRACT(DOW FROM cp.dt)::int
      )
  ),
  slot_count_by_day AS (
    SELECT
      ewp.dt,
      ewp.pattern_id,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM attendance_pattern_slots s
          WHERE s.pattern_id = ewp.pattern_id
            AND s.day_of_week = EXTRACT(DOW FROM ewp.dt)::int
        )
        THEN (
          SELECT COUNT(*)
          FROM attendance_pattern_slots s
          WHERE s.pattern_id = ewp.pattern_id
            AND s.day_of_week = EXTRACT(DOW FROM ewp.dt)::int
        )
        ELSE (
          SELECT COUNT(*)
          FROM attendance_pattern_slots s
          WHERE s.pattern_id = ewp.pattern_id
            AND s.day_of_week IS NULL
        )
      END AS slots_n
    FROM expected_with_pattern ewp
  ),
  cancelled_count_by_day AS (
    SELECT
      sc.dt,
      COUNT(*) AS cancelled_n
    FROM slot_count_by_day sc
    JOIN cancelled_slots cs
      ON cs.cancelled_date = sc.dt
      AND cs.class_id = v_class_id
      AND (cs.section_id IS NULL OR cs.section_id = v_section_id)
      AND cs.slot_index BETWEEN 1 AND GREATEST(COALESCE(sc.slots_n, 0), 0)
    GROUP BY sc.dt
  ),
  effective_slot_count AS (
    SELECT
      sc.dt,
      sc.pattern_id,
      GREATEST(COALESCE(sc.slots_n, 0) - COALESCE(cc.cancelled_n, 0), 0) AS slots_n
    FROM slot_count_by_day sc
    LEFT JOIN cancelled_count_by_day cc ON cc.dt = sc.dt
  )
  SELECT
    (SELECT COUNT(*) FROM expected),
    (
      SELECT COUNT(DISTINCT a.absent_date)
      FROM student_absences a
      WHERE a.student_id = p_student_id
        AND a.absent_date BETWEEN p_from AND p_to
        AND EXISTS (SELECT 1 FROM expected e WHERE e.dt = a.absent_date)
        AND NOT EXISTS (
          SELECT 1 FROM cancelled_slots cs
          WHERE cs.cancelled_date = a.absent_date
            AND cs.slot_index = a.slot_index
            AND cs.class_id = v_class_id
            AND (cs.section_id IS NULL OR cs.section_id = v_section_id)
        )
    ),
    (
      SELECT COALESCE(SUM(GREATEST(COALESCE(slots_n, 0), 0)), 0)
      FROM effective_slot_count
    ),
    (
      SELECT COUNT(*)
      FROM student_absences a
      JOIN effective_slot_count sc
        ON sc.dt = a.absent_date
      WHERE a.student_id = p_student_id
        AND a.absent_date BETWEEN p_from AND p_to
        AND a.slot_index BETWEEN 1 AND GREATEST(COALESCE(sc.slots_n, 0), 0)
        AND NOT EXISTS (
          SELECT 1 FROM cancelled_slots cs
          WHERE cs.cancelled_date = a.absent_date
            AND cs.slot_index = a.slot_index
            AND cs.class_id = v_class_id
            AND (cs.section_id IS NULL OR cs.section_id = v_section_id)
        )
    )
  INTO v_expected_days, v_absent_days, v_expected_sessions, v_absent_sessions;

  RETURN QUERY
  SELECT
    200,
    'Attendance summary fetched successfully',
    jsonb_build_object(
      'student_id', p_student_id,
      'from', p_from,
      'to', p_to,
      'expected_days', COALESCE(v_expected_days, 0),
      'absent_days', COALESCE(v_absent_days, 0),
      'present_days', GREATEST(COALESCE(v_expected_days, 0) - COALESCE(v_absent_days, 0), 0),
      'expected_sessions', COALESCE(v_expected_sessions, 0),
      'absent_sessions', COALESCE(v_absent_sessions, 0),
      'present_sessions', GREATEST(COALESCE(v_expected_sessions, 0) - COALESCE(v_absent_sessions, 0), 0)
    );
END;
$$;
