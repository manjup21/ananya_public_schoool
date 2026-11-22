-- ============================================================
-- DASHBOARD FUNCTIONS (Admin + Lecturer)
-- Aggregated KPI payloads for landing dashboards.
-- ============================================================

CREATE OR REPLACE FUNCTION public.atr_get_admin_dashboard(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tot_students INT;
  v_tot_lecturers INT;
  v_tot_classes INT;
  v_tot_sections INT;
  v_tot_subjects INT;
  v_tot_exams INT;
  v_expected_days_total INT;
  v_absent_days_total INT;
  v_expected_sessions_total INT;
  v_absent_sessions_total INT;
  v_attendance_rate NUMERIC;
  v_avg_exam_pct NUMERIC;
  v_absences_by_day JSONB;
  v_upcoming_exams JSONB;
  v_exams_by_status JSONB;
  v_students_by_class JSONB;
  v_recent_students JSONB;
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN QUERY SELECT 400, 'from and to dates are required', NULL::jsonb; RETURN;
  END IF;
  IF p_to < p_from THEN
    RETURN QUERY SELECT 400, 'to date must be on or after from date', NULL::jsonb; RETURN;
  END IF;

  SELECT COUNT(*) INTO v_tot_students FROM students WHERE is_deleted = FALSE;
  SELECT COUNT(*) INTO v_tot_lecturers FROM lecturers;
  SELECT COUNT(*) INTO v_tot_classes FROM classes;
  SELECT COUNT(*) INTO v_tot_sections FROM sections;
  SELECT COUNT(*) INTO v_tot_subjects FROM subjects WHERE is_deleted = FALSE;
  SELECT COUNT(*) INTO v_tot_exams FROM examinations;

  -- Attendance aggregates across active, non-deleted students.
  -- IMPORTANT:
  -- - student_absences is stored per (date, slot_index)
  -- - so attendance_rate must be computed on SESSIONS, not just DAYS
  WITH active_students AS (
    SELECT id AS student_id, class_id, section_id
    FROM students
    WHERE is_deleted = FALSE AND is_active = TRUE
  ),
  days AS (
    SELECT d::date AS dt
    FROM generate_series(p_from, p_to, interval '1 day') d
    WHERE NOT public.atr_is_institution_holiday(d::date)
  ),
  chosen_pattern AS (
    SELECT
      s.student_id,
      days.dt,
      COALESCE(sec.id, cls.id, glb.id) AS pattern_id
    FROM active_students s
    CROSS JOIN days
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'section'
        AND p.class_id = s.class_id
        AND p.section_id = s.section_id
        AND days.dt BETWEEN p.start_date AND p.end_date
      ORDER BY p.start_date DESC, p.created_at DESC
      LIMIT 1
    ) sec ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'class'
        AND p.class_id = s.class_id
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
    SELECT cp.student_id, cp.dt
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
      cp.student_id,
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
  slot_count_by_student_day AS (
    SELECT
      ewp.student_id,
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
  cancelled_count_by_student_day AS (
    SELECT
      sc.student_id,
      sc.dt,
      COUNT(*) AS cancelled_n
    FROM slot_count_by_student_day sc
    JOIN active_students ast ON ast.student_id = sc.student_id
    JOIN cancelled_slots cs
      ON cs.cancelled_date = sc.dt
      AND cs.class_id = ast.class_id
      AND (cs.section_id IS NULL OR cs.section_id = ast.section_id)
      AND cs.slot_index BETWEEN 1 AND GREATEST(COALESCE(sc.slots_n, 0), 0)
    GROUP BY sc.student_id, sc.dt
  ),
  effective_slot_count AS (
    SELECT
      sc.student_id,
      sc.dt,
      sc.pattern_id,
      GREATEST(COALESCE(sc.slots_n, 0) - COALESCE(cc.cancelled_n, 0), 0) AS slots_n
    FROM slot_count_by_student_day sc
    LEFT JOIN cancelled_count_by_student_day cc
      ON cc.student_id = sc.student_id AND cc.dt = sc.dt
  ),
  absent_sessions AS (
    SELECT
      a.student_id,
      a.absent_date AS dt,
      a.slot_index
    FROM student_absences a
    JOIN active_students ast ON ast.student_id = a.student_id
    WHERE a.absent_date BETWEEN p_from AND p_to
      AND NOT EXISTS (
        SELECT 1 FROM cancelled_slots cs
        WHERE cs.cancelled_date = a.absent_date
          AND cs.slot_index = a.slot_index
          AND cs.class_id = ast.class_id
          AND (cs.section_id IS NULL OR cs.section_id = ast.section_id)
      )
  )
  SELECT
    (SELECT COUNT(*) FROM expected),
    (
      SELECT COUNT(*)
      FROM (
        SELECT DISTINCT a.student_id, a.dt
        FROM absent_sessions a
        JOIN expected e ON e.student_id = a.student_id AND e.dt = a.dt
      ) x
    ),
    (
      SELECT COALESCE(SUM(GREATEST(COALESCE(slots_n, 0), 0)), 0)
      FROM effective_slot_count
    ),
    (
      SELECT COUNT(*)
      FROM absent_sessions a
      JOIN effective_slot_count sc
        ON sc.student_id = a.student_id AND sc.dt = a.dt
      WHERE a.slot_index BETWEEN 1 AND GREATEST(COALESCE(sc.slots_n, 0), 0)
    )
  INTO v_expected_days_total, v_absent_days_total, v_expected_sessions_total, v_absent_sessions_total;

  v_attendance_rate :=
    CASE
      WHEN COALESCE(v_expected_sessions_total, 0) <= 0 THEN 0
      ELSE ROUND(
        ((v_expected_sessions_total - COALESCE(v_absent_sessions_total, 0))::numeric / v_expected_sessions_total::numeric) * 100,
        2
      )
    END;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb) INTO v_absences_by_day
  FROM (
    SELECT
      a.absent_date AS date,
      COUNT(DISTINCT a.student_id) AS students_absent
    FROM student_absences a
    JOIN students s ON s.id = a.student_id AND s.is_deleted = FALSE
    WHERE a.absent_date BETWEEN p_from AND p_to
      AND NOT public.atr_is_institution_holiday(a.absent_date)
      AND NOT EXISTS (
        SELECT 1 FROM cancelled_slots cs
        WHERE cs.cancelled_date = a.absent_date
          AND cs.slot_index = a.slot_index
          AND cs.class_id = s.class_id
          AND (cs.section_id IS NULL OR cs.section_id = s.section_id)
      )
    GROUP BY a.absent_date
    ORDER BY a.absent_date
  ) x;

  -- Exams (upcoming next 7 days) + status counts
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.exam_date, x.start_time), '[]'::jsonb) INTO v_upcoming_exams
  FROM (
    SELECT
      e.id,
      e.test_name,
      et.name AS exam_type,
      e.exam_status,
      e.exam_date,
      e.start_time,
      e.end_time,
      c.name AS class_name,
      s.section_code AS section_code
    FROM examinations e
    JOIN exam_types et ON et.id = e.exam_type_id
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections s ON s.id = e.section_id
    WHERE e.exam_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')::date
    ORDER BY e.exam_date ASC, e.start_time ASC
    LIMIT 20
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.exam_status), '[]'::jsonb) INTO v_exams_by_status
  FROM (
    SELECT e.exam_status, COUNT(*) AS count
    FROM examinations e
    GROUP BY e.exam_status
  ) x;

  SELECT
    ROUND(COALESCE(AVG((r.total_marks::numeric / NULLIF(e.max_marks, 0)::numeric) * 100), 0), 2)
  INTO v_avg_exam_pct
  FROM examination_results r
  JOIN examinations e ON e.id = r.examination_id
  WHERE r.result_status = 'published'
    AND r.total_marks IS NOT NULL
    AND e.max_marks > 0
    AND e.exam_date BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.class_name), '[]'::jsonb) INTO v_students_by_class
  FROM (
    SELECT
      c.name AS class_name,
      COUNT(*) FILTER (WHERE s.is_deleted = FALSE) AS students
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
    GROUP BY c.name
    ORDER BY c.name
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_recent_students
  FROM (
    SELECT
      s.id,
      s.roll_number,
      s.first_name,
      s.last_name,
      s.created_at,
      c.name AS class_name,
      sec.section_code AS section_code
    FROM students s
    JOIN classes c ON c.id = s.class_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    WHERE s.is_deleted = FALSE
    ORDER BY s.created_at DESC
    LIMIT 5
  ) x;

  RETURN QUERY
  SELECT 200, 'Admin dashboard fetched successfully',
    jsonb_build_object(
      'range', jsonb_build_object('from', p_from, 'to', p_to),
      'totals', jsonb_build_object(
        'students', v_tot_students,
        'lecturers', v_tot_lecturers,
        'classes', v_tot_classes,
        'sections', v_tot_sections,
        'subjects', v_tot_subjects,
        'exams', v_tot_exams
      ),
      'attendance', jsonb_build_object(
        'expected_days_total', COALESCE(v_expected_days_total, 0),
        'absent_days_total', COALESCE(v_absent_days_total, 0),
        'expected_sessions_total', COALESCE(v_expected_sessions_total, 0),
        'absent_sessions_total', COALESCE(v_absent_sessions_total, 0),
        'attendance_rate', COALESCE(v_attendance_rate, 0),
        'absences_by_day', COALESCE(v_absences_by_day, '[]'::jsonb)
      ),
      'exams', jsonb_build_object(
        'avg_exam_percentage_overall', COALESCE(v_avg_exam_pct, 0),
        'exams_by_status', COALESCE(v_exams_by_status, '[]'::jsonb),
        'upcoming_exams', COALESCE(v_upcoming_exams, '[]'::jsonb)
      ),
      'students_by_class', COALESCE(v_students_by_class, '[]'::jsonb),
      'recent_students', COALESCE(v_recent_students, '[]'::jsonb)
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_get_lecturer_dashboard(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tot_students INT;
  v_tot_classes INT;
  v_tot_sections INT;
  v_expected_days_total INT;
  v_absent_days_total INT;
  v_expected_sessions_total INT;
  v_absent_sessions_total INT;
  v_attendance_rate NUMERIC;
  v_avg_exam_pct NUMERIC;
  v_absences_by_day JSONB;
  v_upcoming_exams JSONB;
  v_exams_by_status JSONB;
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN QUERY SELECT 400, 'from and to dates are required', NULL::jsonb; RETURN;
  END IF;
  IF p_to < p_from THEN
    RETURN QUERY SELECT 400, 'to date must be on or after from date', NULL::jsonb; RETURN;
  END IF;

  SELECT COUNT(*) INTO v_tot_students FROM students WHERE is_deleted = FALSE AND is_active = TRUE;
  SELECT COUNT(*) INTO v_tot_classes FROM classes;
  SELECT COUNT(*) INTO v_tot_sections FROM sections;

  -- Attendance aggregates across active, non-deleted students (SESSION-based).
  WITH active_students AS (
    SELECT id AS student_id, class_id, section_id
    FROM students
    WHERE is_deleted = FALSE AND is_active = TRUE
  ),
  days AS (
    SELECT d::date AS dt
    FROM generate_series(p_from, p_to, interval '1 day') d
    WHERE NOT public.atr_is_institution_holiday(d::date)
  ),
  chosen_pattern AS (
    SELECT
      s.student_id,
      days.dt,
      COALESCE(sec.id, cls.id, glb.id) AS pattern_id
    FROM active_students s
    CROSS JOIN days
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'section'
        AND p.class_id = s.class_id
        AND p.section_id = s.section_id
        AND days.dt BETWEEN p.start_date AND p.end_date
      ORDER BY p.start_date DESC, p.created_at DESC
      LIMIT 1
    ) sec ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM attendance_patterns p
      WHERE p.scope = 'class'
        AND p.class_id = s.class_id
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
    SELECT cp.student_id, cp.dt
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
      cp.student_id,
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
  slot_count_by_student_day AS (
    SELECT
      ewp.student_id,
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
  cancelled_count_by_student_day AS (
    SELECT
      sc.student_id,
      sc.dt,
      COUNT(*) AS cancelled_n
    FROM slot_count_by_student_day sc
    JOIN active_students ast ON ast.student_id = sc.student_id
    JOIN cancelled_slots cs
      ON cs.cancelled_date = sc.dt
      AND cs.class_id = ast.class_id
      AND (cs.section_id IS NULL OR cs.section_id = ast.section_id)
      AND cs.slot_index BETWEEN 1 AND GREATEST(COALESCE(sc.slots_n, 0), 0)
    GROUP BY sc.student_id, sc.dt
  ),
  effective_slot_count AS (
    SELECT
      sc.student_id,
      sc.dt,
      sc.pattern_id,
      GREATEST(COALESCE(sc.slots_n, 0) - COALESCE(cc.cancelled_n, 0), 0) AS slots_n
    FROM slot_count_by_student_day sc
    LEFT JOIN cancelled_count_by_student_day cc
      ON cc.student_id = sc.student_id AND cc.dt = sc.dt
  ),
  absent_sessions AS (
    SELECT
      a.student_id,
      a.absent_date AS dt,
      a.slot_index
    FROM student_absences a
    JOIN active_students ast ON ast.student_id = a.student_id
    WHERE a.absent_date BETWEEN p_from AND p_to
      AND NOT EXISTS (
        SELECT 1 FROM cancelled_slots cs
        WHERE cs.cancelled_date = a.absent_date
          AND cs.slot_index = a.slot_index
          AND cs.class_id = ast.class_id
          AND (cs.section_id IS NULL OR cs.section_id = ast.section_id)
      )
  )
  SELECT
    (SELECT COUNT(*) FROM expected),
    (
      SELECT COUNT(*)
      FROM (
        SELECT DISTINCT a.student_id, a.dt
        FROM absent_sessions a
        JOIN expected e ON e.student_id = a.student_id AND e.dt = a.dt
      ) x
    ),
    (
      SELECT COALESCE(SUM(GREATEST(COALESCE(slots_n, 0), 0)), 0)
      FROM effective_slot_count
    ),
    (
      SELECT COUNT(*)
      FROM absent_sessions a
      JOIN effective_slot_count sc
        ON sc.student_id = a.student_id AND sc.dt = a.dt
      WHERE a.slot_index BETWEEN 1 AND GREATEST(COALESCE(sc.slots_n, 0), 0)
    )
  INTO v_expected_days_total, v_absent_days_total, v_expected_sessions_total, v_absent_sessions_total;

  v_attendance_rate :=
    CASE
      WHEN COALESCE(v_expected_sessions_total, 0) <= 0 THEN 0
      ELSE ROUND(
        ((v_expected_sessions_total - COALESCE(v_absent_sessions_total, 0))::numeric / v_expected_sessions_total::numeric) * 100,
        2
      )
    END;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb) INTO v_absences_by_day
  FROM (
    SELECT
      a.absent_date AS date,
      COUNT(DISTINCT a.student_id) AS students_absent
    FROM student_absences a
    JOIN students s ON s.id = a.student_id AND s.is_deleted = FALSE AND s.is_active = TRUE
    WHERE a.absent_date BETWEEN p_from AND p_to
      AND NOT public.atr_is_institution_holiday(a.absent_date)
      AND NOT EXISTS (
        SELECT 1 FROM cancelled_slots cs
        WHERE cs.cancelled_date = a.absent_date
          AND cs.slot_index = a.slot_index
          AND cs.class_id = s.class_id
          AND (cs.section_id IS NULL OR cs.section_id = s.section_id)
      )
    GROUP BY a.absent_date
    ORDER BY a.absent_date
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.exam_date, x.start_time), '[]'::jsonb) INTO v_upcoming_exams
  FROM (
    SELECT
      e.id,
      e.test_name,
      et.name AS exam_type,
      e.exam_status,
      e.exam_date,
      e.start_time,
      e.end_time,
      c.name AS class_name,
      s.section_code AS section_code
    FROM examinations e
    JOIN exam_types et ON et.id = e.exam_type_id
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections s ON s.id = e.section_id
    WHERE e.exam_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')::date
    ORDER BY e.exam_date ASC, e.start_time ASC
    LIMIT 20
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.exam_status), '[]'::jsonb) INTO v_exams_by_status
  FROM (
    SELECT e.exam_status, COUNT(*) AS count
    FROM examinations e
    WHERE e.exam_date BETWEEN p_from AND p_to
    GROUP BY e.exam_status
  ) x;

  SELECT
    ROUND(COALESCE(AVG((r.total_marks::numeric / NULLIF(e.max_marks, 0)::numeric) * 100), 0), 2)
  INTO v_avg_exam_pct
  FROM examination_results r
  JOIN examinations e ON e.id = r.examination_id
  JOIN students s ON s.id = r.student_id AND s.is_deleted = FALSE AND s.is_active = TRUE
  WHERE r.result_status = 'published'
    AND r.total_marks IS NOT NULL
    AND e.max_marks > 0
    AND e.exam_date BETWEEN p_from AND p_to;

  RETURN QUERY
  SELECT 200, 'Lecturer dashboard fetched successfully',
    jsonb_build_object(
      'range', jsonb_build_object('from', p_from, 'to', p_to),
      'totals', jsonb_build_object(
        'students', v_tot_students,
        'classes', v_tot_classes,
        'sections', v_tot_sections
      ),
      'attendance', jsonb_build_object(
        'expected_days_total', COALESCE(v_expected_days_total, 0),
        'absent_days_total', COALESCE(v_absent_days_total, 0),
        'expected_sessions_total', COALESCE(v_expected_sessions_total, 0),
        'absent_sessions_total', COALESCE(v_absent_sessions_total, 0),
        'attendance_rate', COALESCE(v_attendance_rate, 0),
        'absences_by_day', COALESCE(v_absences_by_day, '[]'::jsonb)
      ),
      'exams', jsonb_build_object(
        'avg_exam_percentage_overall', COALESCE(v_avg_exam_pct, 0),
        'exams_by_status', COALESCE(v_exams_by_status, '[]'::jsonb),
        'upcoming_exams', COALESCE(v_upcoming_exams, '[]'::jsonb)
      )
    );
END;
$$;

