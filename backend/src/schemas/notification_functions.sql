-- ============================================================
-- NOTIFICATION FUNCTIONS
-- - Attendance absence summary by section for a given date
-- - Absent students detail for a section on a given date
-- - Exam notification candidates (published results)
-- - Insert notification log
-- - Get last notification log for a scope
-- ============================================================

-- Attendance absence summary grouped by class/section for a date.
-- Returns one row per (class_id, section_id) that has at least one absence.
CREATE OR REPLACE FUNCTION public.atr_get_absence_summary_by_date(
  p_date DATE
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_date IS NULL THEN
    RETURN QUERY SELECT 400, 'date is required', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Absence summary fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.class_name, x.section_code NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT
      s.class_id,
      c.name AS class_name,
      s.section_id,
      sec.section_code,
      COUNT(DISTINCT s.id) FILTER (WHERE a.id IS NOT NULL) AS absent_count,
      (
        SELECT COUNT(*)
        FROM students s2
        WHERE s2.class_id = s.class_id
          AND ((s.section_id IS NULL AND s2.section_id IS NULL) OR s2.section_id = s.section_id)
          AND s2.is_deleted = FALSE
          AND s2.is_active = TRUE
      ) AS total_students
    FROM student_absences a
    JOIN students s ON s.id = a.student_id AND s.is_deleted = FALSE
    JOIN classes c ON c.id = s.class_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    WHERE a.absent_date = p_date
    GROUP BY s.class_id, c.name, s.section_id, sec.section_code
  ) x;
END;
$$;


-- Absent students detail for a specific class/section on a date.
-- Returns student info + guardian contact + array of absent slot names.
CREATE OR REPLACE FUNCTION public.atr_get_section_absent_students(
  p_class_id UUID,
  p_section_id UUID,
  p_date DATE
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

  RETURN QUERY
  SELECT
    200,
    'Absent students fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.roll_number), '[]'::jsonb)
  FROM (
    SELECT
      s.id AS student_id,
      s.roll_number,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      s.father_name,
      s.guardian_phone,
      ARRAY_AGG(
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
                (ap.scope = 'section' AND ap.class_id = s.class_id AND ap.section_id = s.section_id)
                OR (ap.scope = 'class' AND ap.class_id = s.class_id AND ap.section_id IS NULL)
                OR (ap.scope = 'global')
              )
            ORDER BY
              CASE ap.scope WHEN 'section' THEN 1 WHEN 'class' THEN 2 ELSE 3 END
            LIMIT 1
          ),
          'Period ' || a.slot_index
        )
        ORDER BY a.slot_index
      ) AS absent_slots
    FROM student_absences a
    JOIN students s ON s.id = a.student_id AND s.is_deleted = FALSE
    WHERE a.absent_date = p_date
      AND s.class_id = p_class_id
      AND (p_section_id IS NULL OR s.section_id = p_section_id)
    GROUP BY s.id, s.roll_number, s.first_name, s.last_name, s.father_name, s.guardian_phone
  ) x;
END;
$$;


-- Exam notification candidates: students with results for a completed exam.
CREATE OR REPLACE FUNCTION public.atr_get_exam_notification_candidates(
  p_examination_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_examination_id IS NULL THEN
    RETURN QUERY SELECT 400, 'examination_id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM examinations WHERE id = p_examination_id) THEN
    RETURN QUERY SELECT 404, 'Examination not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Exam notification candidates fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.roll_number), '[]'::jsonb)
  FROM (
    SELECT
      s.id AS student_id,
      s.roll_number,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      s.father_name,
      s.guardian_phone,
      r.total_marks,
      r.result_status,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'subject_name', sub.name,
            'mark', m.mark,
            'max_marks', es.max_marks,
            'is_absent', m.is_absent,
            'is_part_b', es.is_part_b,
            'grade_text', m.grade_text
          ) ORDER BY es.is_part_b ASC, sub.sort_order, sub.name
        ), '[]'::jsonb)
        FROM examination_result_marks m
        JOIN examination_subjects es ON es.examination_id = p_examination_id AND es.subject_id = m.subject_id
        JOIN subjects sub ON sub.id = m.subject_id
        WHERE m.result_id = r.id
      ) AS subject_marks
    FROM examination_results r
    JOIN students s ON s.id = r.student_id AND s.is_deleted = FALSE
    WHERE r.examination_id = p_examination_id
  ) x;
END;
$$;


-- Insert a notification log entry.
CREATE OR REPLACE FUNCTION public.atr_insert_notification_log(
  p_type VARCHAR,
  p_channel VARCHAR,
  p_reference_date DATE,
  p_reference_id UUID,
  p_class_id UUID,
  p_section_id UUID,
  p_recipient_count INT,
  p_status VARCHAR,
  p_payload_preview TEXT,
  p_created_by UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notification_logs (
    id, type, channel, reference_date, reference_id,
    class_id, section_id, recipient_count, status,
    payload_preview, created_by
  )
  VALUES (
    uuid_generate_v4(), p_type, p_channel, p_reference_date, p_reference_id,
    p_class_id, p_section_id, p_recipient_count, COALESCE(p_status, 'sent'),
    p_payload_preview, p_created_by
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 201, 'Notification log created', jsonb_build_object('id', v_id);
END;
$$;


-- Update a notification log after background processing completes.
CREATE OR REPLACE FUNCTION public.atr_update_notification_log(
  p_id UUID,
  p_recipient_count INT,
  p_status VARCHAR
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sent INT;
  v_failed INT;
BEGIN
  IF p_id IS NULL THEN
    RETURN QUERY SELECT 400, 'id is required', NULL::jsonb; RETURN;
  END IF;

  SELECT COUNT(*) FILTER (WHERE nr.status = 'sent'),
         COUNT(*) FILTER (WHERE nr.status = 'failed')
  INTO v_sent, v_failed
  FROM notification_recipients nr
  WHERE nr.log_id = p_id;

  UPDATE notification_logs
  SET recipient_count = COALESCE(p_recipient_count, recipient_count),
      status = COALESCE(p_status, status),
      sent_count = v_sent,
      failed_count = v_failed
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'Notification log not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY SELECT 200, 'Notification log updated', jsonb_build_object('id', p_id);
END;
$$;


-- Bulk-insert recipient rows for a notification log.
CREATE OR REPLACE FUNCTION public.atr_insert_notification_recipients(
  p_log_id UUID,
  p_recipients JSONB
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_log_id IS NULL THEN
    RETURN QUERY SELECT 400, 'log_id is required', NULL::jsonb; RETURN;
  END IF;

  INSERT INTO notification_recipients (id, log_id, student_id, guardian_phone, status, notified_slots)
  SELECT
    uuid_generate_v4(),
    p_log_id,
    (r->>'student_id')::uuid,
    r->>'guardian_phone',
    'pending',
    CASE
      WHEN r ? 'notified_slots' AND jsonb_typeof(r->'notified_slots') = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(r->'notified_slots'))
      ELSE NULL
    END
  FROM jsonb_array_elements(p_recipients) AS r;

  RETURN QUERY SELECT 201, 'Recipients inserted', jsonb_build_object('count', jsonb_array_length(p_recipients));
END;
$$;


-- Update a single recipient's delivery status.
CREATE OR REPLACE FUNCTION public.atr_update_notification_recipient(
  p_id UUID,
  p_status VARCHAR,
  p_error_reason TEXT DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE notification_recipients
  SET status = p_status,
      error_reason = p_error_reason,
      sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'Recipient not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY SELECT 200, 'Recipient updated', jsonb_build_object('id', p_id);
END;
$$;


-- Get failed recipients for a notification log (for retry).
CREATE OR REPLACE FUNCTION public.atr_get_failed_recipients(
  p_log_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_log_id IS NULL THEN
    RETURN QUERY SELECT 400, 'log_id is required', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Failed recipients fetched',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.student_name), '[]'::jsonb)
  FROM (
    SELECT
      nr.id AS recipient_id,
      nr.student_id,
      nr.guardian_phone,
      nr.error_reason,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      s.roll_number
    FROM notification_recipients nr
    JOIN students s ON s.id = nr.student_id
    WHERE nr.log_id = p_log_id
      AND nr.status = 'failed'
  ) x;
END;
$$;


-- Get per-student notification status for a given log, keyed by student_id.
CREATE OR REPLACE FUNCTION public.atr_get_recipient_statuses(
  p_log_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_log_id IS NULL THEN
    RETURN QUERY SELECT 200, 'No log_id provided', '{}'::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Recipient statuses fetched',
    COALESCE(
      jsonb_object_agg(x.student_id::text, to_jsonb(x) - 'student_id'),
      '{}'::jsonb
    )
  FROM (
    SELECT
      nr.student_id,
      nr.id AS recipient_id,
      nr.status,
      nr.error_reason,
      nr.sent_at
    FROM notification_recipients nr
    WHERE nr.log_id = p_log_id
  ) x;
END;
$$;


-- Union of absent slot names successfully notified per student for a class/section/date.
CREATE OR REPLACE FUNCTION public.atr_get_notified_slots_by_section_date(
  p_class_id UUID,
  p_section_id UUID,
  p_date DATE
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

  RETURN QUERY
  SELECT
    200,
    'Notified slots fetched',
    COALESCE(
      jsonb_object_agg(x.student_id::text, to_jsonb(x.slots)),
      '{}'::jsonb
    )
  FROM (
    SELECT
      nr.student_id,
      ARRAY_AGG(DISTINCT slot_name ORDER BY slot_name) AS slots
    FROM notification_recipients nr
    JOIN notification_logs nl ON nl.id = nr.log_id
    CROSS JOIN LATERAL unnest(nr.notified_slots) AS slot_name
    WHERE nl.type = 'attendance'
      AND nl.reference_date = p_date
      AND nl.class_id = p_class_id
      AND ((p_section_id IS NULL AND nl.section_id IS NULL) OR nl.section_id = p_section_id)
      AND nr.status = 'sent'
      AND nr.notified_slots IS NOT NULL
    GROUP BY nr.student_id
  ) x;
END;
$$;


-- Get the last notification log for a given scope.
-- Stale 'processing' logs (>5 min) are reported as 'failed'.
CREATE OR REPLACE FUNCTION public.atr_get_last_notification_log(
  p_type VARCHAR,
  p_class_id UUID,
  p_section_id UUID,
  p_reference_date DATE,
  p_reference_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    200,
    'Last notification log fetched',
    CASE
      WHEN nl.id IS NOT NULL THEN
        jsonb_build_object(
          'id', nl.id,
          'channel', nl.channel,
          'recipient_count', nl.recipient_count,
          'sent_count', COALESCE(nl.sent_count, 0),
          'failed_count', COALESCE(nl.failed_count, 0),
          'status', CASE
            WHEN nl.status = 'processing' AND nl.created_at < NOW() - INTERVAL '5 minutes'
            THEN 'failed'
            ELSE nl.status
          END,
          'created_at', nl.created_at,
          'created_by', nl.created_by,
          'created_by_name', COALESCE(u.name, NULL)
        )
      ELSE NULL
    END
  FROM (SELECT 1) AS dummy
  LEFT JOIN LATERAL (
    SELECT *
    FROM notification_logs n
    WHERE n.type = p_type
      AND n.class_id = p_class_id
      AND ((p_section_id IS NULL AND n.section_id IS NULL) OR n.section_id = p_section_id)
      AND (p_reference_date IS NULL OR n.reference_date = p_reference_date)
      AND (p_reference_id IS NULL OR n.reference_id = p_reference_id)
    ORDER BY n.created_at DESC
    LIMIT 1
  ) nl ON TRUE
  LEFT JOIN users u ON u.id = nl.created_by;
END;
$$;


-- List notification logs (paginated, filterable by type).
CREATE OR REPLACE FUNCTION public.atr_list_notification_logs(
  p_type VARCHAR DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    200,
    'Notification logs fetched',
    jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
        FROM (
          SELECT
            n.id,
            n.type,
            n.channel,
            n.reference_date,
            n.reference_id,
            n.class_id,
            c.name AS class_name,
            n.section_id,
            sec.section_code,
            n.recipient_count,
            n.status,
            n.payload_preview,
            n.created_by,
            u.name AS created_by_name,
            n.created_at
          FROM notification_logs n
          JOIN classes c ON c.id = n.class_id
          LEFT JOIN sections sec ON sec.id = n.section_id
          LEFT JOIN users u ON u.id = n.created_by
          WHERE (p_type IS NULL OR BTRIM(p_type) = '' OR n.type = p_type)
          ORDER BY n.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) x
      ), '[]'::jsonb),
      'total', (
        SELECT COUNT(*)
        FROM notification_logs n
        WHERE (p_type IS NULL OR BTRIM(p_type) = '' OR n.type = p_type)
      )
    );
END;
$$;


-- Fee due: outstanding-balance counts per class/section for an academic year.
CREATE OR REPLACE FUNCTION public.atr_get_fee_due_notification_summary(
  p_academic_year VARCHAR
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_academic_year IS NULL OR BTRIM(p_academic_year) = '' THEN
    RETURN QUERY SELECT 400, 'academic_year is required', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Fee due notification summary fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.class_name, x.section_label NULLS FIRST), '[]'::jsonb)
  FROM (
    SELECT
      s.class_id,
      c.name AS class_name,
      s.section_id,
      sec.section_code AS section_label,
      BTRIM(p_academic_year) AS academic_year,
      COUNT(*)::INT AS outstanding_count
    FROM students s
    JOIN classes c ON c.id = s.class_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    JOIN student_fees sf
      ON sf.student_id = s.id AND sf.academic_year = BTRIM(p_academic_year)
    LEFT JOIN (
      SELECT student_fee_id, COALESCE(SUM(amount), 0) AS total_paid
      FROM fee_payments
      GROUP BY student_fee_id
    ) paid ON paid.student_fee_id = sf.id
    WHERE s.is_deleted = FALSE
      AND (sf.net_fee - COALESCE(paid.total_paid, 0)) > 0
    GROUP BY s.class_id, c.name, s.section_id, sec.section_code
  ) x;
END;
$$;

CREATE OR REPLACE FUNCTION public.atr_get_fee_due_notification_students(
  p_class_id UUID,
  p_section_id UUID,
  p_academic_year VARCHAR
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;
  IF p_academic_year IS NULL OR BTRIM(p_academic_year) = '' THEN
    RETURN QUERY SELECT 400, 'academic_year is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
    RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Fee due notification students fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.roll_number), '[]'::jsonb)
  FROM (
    SELECT
      s.id AS student_id,
      s.roll_number,
      BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS student_name,
      COALESCE(NULLIF(BTRIM(s.father_name), ''), NULLIF(BTRIM(s.mother_name), '')) AS guardian_name,
      s.guardian_phone,
      sf.net_fee,
      COALESCE(paid.total_paid, 0) AS total_paid,
      (sf.net_fee - COALESCE(paid.total_paid, 0)) AS balance
    FROM students s
    JOIN student_fees sf
      ON sf.student_id = s.id AND sf.academic_year = BTRIM(p_academic_year)
    LEFT JOIN (
      SELECT student_fee_id, COALESCE(SUM(amount), 0) AS total_paid
      FROM fee_payments
      GROUP BY student_fee_id
    ) paid ON paid.student_fee_id = sf.id
    WHERE s.is_deleted = FALSE
      AND s.class_id = p_class_id
      AND (
        (p_section_id IS NULL AND s.section_id IS NULL)
        OR s.section_id = p_section_id
      )
      AND (sf.net_fee - COALESCE(paid.total_paid, 0)) > 0
  ) x;
END;
$$;