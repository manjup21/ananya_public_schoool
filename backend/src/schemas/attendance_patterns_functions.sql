-- ============================================================
-- ATTENDANCE PATTERNS FUNCTIONS (ATR-style procedures)
-- - CRUD for attendance_patterns (+ days + slots)
-- - Resolve applicable pattern for a given class/section + date
-- Notes:
-- - Uses schema constraints (unique + exclusion) to prevent duplicates/overlaps.
-- - Transaction safety: Each function call is atomic. If any step fails (pattern/days/slots),
--   PostgreSQL rolls back the whole function’s work. The EXCEPTION blocks below use an implicit
--   sub-transaction so partial inserts/updates do not persist.
-- - Days of week stored as int: 0=Sun .. 6=Sat
-- ============================================================

-- Hard-delete inactive patterns that overlap the requested scope/date range.
-- Clears leftovers from soft-delete/version flows so the same pattern can be created again.
CREATE OR REPLACE FUNCTION public.atr_purge_inactive_attendance_patterns(
  p_scope VARCHAR,
  p_class_id UUID,
  p_section_id UUID,
  p_section_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_sid UUID;
BEGIN
  IF p_scope = 'global' THEN
    DELETE FROM attendance_patterns p
    WHERE p.is_active = FALSE
      AND p.scope = 'global'
      AND daterange(p.start_date, p.end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
  ELSIF p_scope = 'class' THEN
    DELETE FROM attendance_patterns p
    WHERE p.is_active = FALSE
      AND p.scope = 'class'
      AND p.class_id IS NOT DISTINCT FROM p_class_id
      AND daterange(p.start_date, p.end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
  ELSIF p_scope = 'section' THEN
    IF COALESCE(array_length(p_section_ids, 1), 0) > 0 THEN
      FOREACH v_sid IN ARRAY p_section_ids LOOP
        DELETE FROM attendance_patterns p
        WHERE p.is_active = FALSE
          AND p.scope = 'section'
          AND p.class_id IS NOT DISTINCT FROM p_class_id
          AND p.section_id IS NOT DISTINCT FROM v_sid
          AND daterange(p.start_date, p.end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
      END LOOP;
    ELSIF p_section_id IS NOT NULL THEN
      DELETE FROM attendance_patterns p
      WHERE p.is_active = FALSE
        AND p.scope = 'section'
        AND p.class_id IS NOT DISTINCT FROM p_class_id
        AND p.section_id IS NOT DISTINCT FROM p_section_id
        AND daterange(p.start_date, p.end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
    END IF;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_attendance_pattern_conflict_message(
  p_scope VARCHAR,
  p_class_id UUID,
  p_section_id UUID,
  p_section_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT p.name, p.scope, p.start_date, p.end_date
  INTO v_row
  FROM attendance_patterns p
  WHERE p.is_active = TRUE
    AND daterange(p.start_date, p.end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
    AND (
      (p_scope = 'global' AND p.scope = 'global')
      OR (
        p_scope = 'class'
        AND p.scope = 'class'
        AND p.class_id IS NOT DISTINCT FROM p_class_id
      )
      OR (
        p_scope = 'section'
        AND p.scope = 'section'
        AND p.class_id IS NOT DISTINCT FROM p_class_id
        AND (
          p.section_id IS NOT DISTINCT FROM p_section_id
          OR (
            COALESCE(array_length(p_section_ids, 1), 0) > 0
            AND p.section_id = ANY(p_section_ids)
          )
        )
      )
    )
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN format(
    'Pattern "%s" (%s, %s to %s) already exists for this scope and dates. Set Scope, Class, and Section filters to "All" to find and delete it.',
    v_row.name,
    v_row.scope,
    to_char(v_row.start_date, 'YYYY-MM-DD'),
    to_char(v_row.end_date, 'YYYY-MM-DD')
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_create_attendance_pattern(
  p_name VARCHAR,
  p_scope VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_class_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_days_of_week INT[] DEFAULT NULL,
  p_slot_times TIME[] DEFAULT NULL,
  p_slot_names TEXT[] DEFAULT NULL,
  p_same_slots_all_days BOOLEAN DEFAULT TRUE,
  p_slot_names_by_dow JSONB DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_ids UUID[] := ARRAY[]::uuid[];
  v_batch_id UUID := uuid_generate_v4();
  v_section_class_id UUID;
  v_section_ids UUID[];
  v_sid UUID;
  v_slots_n INT;
  v_days_n INT;
  v_i INT;
  v_same BOOLEAN := TRUE;
  v_slot_names TEXT[];
  v_day_slot_names TEXT[];
  v_day_key TEXT;
  v_distinct_n INT;
  v_j INT;
  v_conflict_msg TEXT;
BEGIN
  IF p_name IS NULL OR BTRIM(p_name) = '' THEN
    RETURN QUERY SELECT 400, 'Pattern name is required', NULL::jsonb; RETURN;
  END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('global','class','section') THEN
    RETURN QUERY SELECT 400, 'Scope must be one of: global, class, section', NULL::jsonb; RETURN;
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN QUERY SELECT 400, 'Start date and end date are required', NULL::jsonb; RETURN;
  END IF;
  IF p_end_date < p_start_date THEN
    RETURN QUERY SELECT 400, 'End date must be on or after start date', NULL::jsonb; RETURN;
  END IF;

  IF p_scope IN ('class','section') AND p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Class is required for class/section scope', NULL::jsonb; RETURN;
  END IF;
  IF p_scope = 'section' THEN
    IF COALESCE(array_length(p_section_ids, 1), 0) < 1 THEN
      IF p_section_id IS NULL THEN
        RETURN QUERY SELECT 400, 'Section is required for section scope', NULL::jsonb; RETURN;
      END IF;
      v_section_ids := ARRAY[p_section_id];
    ELSE
      v_section_ids := p_section_ids;
    END IF;

    SELECT COALESCE(array_agg(x.sid), ARRAY[]::uuid[])
    INTO v_section_ids
    FROM (
      SELECT DISTINCT unnest(v_section_ids) AS sid
    ) x
    WHERE x.sid IS NOT NULL;

    IF COALESCE(array_length(v_section_ids, 1), 0) < 1 THEN
      RETURN QUERY SELECT 400, 'Select at least one section', NULL::jsonb; RETURN;
    END IF;
  END IF;

  IF p_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
    RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
  END IF;

  IF p_scope = 'section' THEN
    FOREACH v_sid IN ARRAY v_section_ids LOOP
      SELECT class_id INTO v_section_class_id FROM sections WHERE id = v_sid;
      IF v_section_class_id IS NULL THEN
        RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
      END IF;
      IF p_class_id IS NOT NULL AND v_section_class_id <> p_class_id THEN
        RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  ELSIF p_section_id IS NOT NULL THEN
    SELECT class_id INTO v_section_class_id FROM sections WHERE id = p_section_id;
    IF v_section_class_id IS NULL THEN
      RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
    END IF;
    IF p_class_id IS NOT NULL AND v_section_class_id <> p_class_id THEN
      RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
    END IF;
  END IF;

  PERFORM public.atr_purge_inactive_attendance_patterns(
    p_scope,
    p_class_id,
    p_section_id,
    CASE WHEN p_scope = 'section' THEN v_section_ids ELSE NULL END,
    p_start_date,
    p_end_date
  );

  v_conflict_msg := public.atr_attendance_pattern_conflict_message(
    p_scope,
    p_class_id,
    p_section_id,
    CASE WHEN p_scope = 'section' THEN v_section_ids ELSE NULL END,
    p_start_date,
    p_end_date
  );
  IF v_conflict_msg IS NOT NULL THEN
    RETURN QUERY SELECT 409, v_conflict_msg, NULL::jsonb; RETURN;
  END IF;

  v_days_n := COALESCE(array_length(p_days_of_week, 1), 0);
  IF v_days_n < 1 THEN
    RETURN QUERY SELECT 400, 'Select at least one day of week', NULL::jsonb; RETURN;
  END IF;
  FOR v_i IN 1..v_days_n LOOP
    IF p_days_of_week[v_i] IS NULL OR p_days_of_week[v_i] < 0 OR p_days_of_week[v_i] > 6 THEN
      RETURN QUERY SELECT 400, 'Days of week must be between 0 (Sun) and 6 (Sat)', NULL::jsonb; RETURN;
    END IF;
  END LOOP;

  v_same := COALESCE(p_same_slots_all_days, TRUE);

  -- Slot model:
  -- - Legacy: p_slot_times required (strictly increasing)
  -- - New: slot names required; slot_time optional (nullable)
  IF p_slot_names IS NULL AND p_slot_names_by_dow IS NULL THEN
    v_slots_n := COALESCE(array_length(p_slot_times, 1), 0);
    IF v_slots_n < 1 OR v_slots_n > 10 THEN
      RETURN QUERY SELECT 400, 'Provide 1 to 10 slot times', NULL::jsonb; RETURN;
    END IF;
    FOR v_i IN 2..v_slots_n LOOP
      IF p_slot_times[v_i] IS NULL OR p_slot_times[v_i-1] IS NULL THEN
        RETURN QUERY SELECT 400, 'All slot times are required', NULL::jsonb; RETURN;
      END IF;
      IF p_slot_times[v_i] <= p_slot_times[v_i-1] THEN
        RETURN QUERY SELECT 400, 'Slot times must be strictly increasing (no duplicates)', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
    v_slot_names := ARRAY[]::text[];
    FOR v_i IN 1..v_slots_n LOOP
      v_slot_names := array_append(v_slot_names, 'Slot ' || v_i::text);
    END LOOP;
  ELSIF v_same THEN
    v_slots_n := COALESCE(array_length(p_slot_names, 1), 0);
    IF v_slots_n < 1 OR v_slots_n > 10 THEN
      RETURN QUERY SELECT 400, 'Provide 1 to 10 slot names', NULL::jsonb; RETURN;
    END IF;
    v_slot_names := ARRAY[]::text[];
    FOR v_i IN 1..v_slots_n LOOP
      v_slot_names := array_append(v_slot_names, regexp_replace(BTRIM(COALESCE(p_slot_names[v_i], '')), '\s+', ' ', 'g'));
    END LOOP;
    IF EXISTS (SELECT 1 FROM unnest(v_slot_names) x(val) WHERE val IS NULL OR val = '') THEN
      RETURN QUERY SELECT 400, 'All slot names are required', NULL::jsonb; RETURN;
    END IF;
    SELECT COUNT(DISTINCT LOWER(val)) INTO v_distinct_n FROM unnest(v_slot_names) x(val);
    IF v_distinct_n <> v_slots_n THEN
      RETURN QUERY SELECT 400, 'Slot names must be unique (case-insensitive)', NULL::jsonb; RETURN;
    END IF;
    -- optional: validate times if provided and length matches
    IF p_slot_times IS NOT NULL AND array_length(p_slot_times, 1) IS NOT NULL THEN
      IF array_length(p_slot_times, 1) <> v_slots_n THEN
        RETURN QUERY SELECT 400, 'slot_times length must match slot_names length when provided', NULL::jsonb; RETURN;
      END IF;
      FOR v_i IN 2..v_slots_n LOOP
        IF p_slot_times[v_i] IS NULL OR p_slot_times[v_i-1] IS NULL THEN
          RETURN QUERY SELECT 400, 'All slot times are required when provided', NULL::jsonb; RETURN;
        END IF;
        IF p_slot_times[v_i] <= p_slot_times[v_i-1] THEN
          RETURN QUERY SELECT 400, 'Slot times must be strictly increasing (no duplicates)', NULL::jsonb; RETURN;
        END IF;
      END LOOP;
    END IF;
  ELSE
    IF p_slot_names_by_dow IS NULL THEN
      RETURN QUERY SELECT 400, 'slot_names_by_dow is required when same_slots_all_days is false', NULL::jsonb; RETURN;
    END IF;
    -- validate each selected day has 1..10 unique slot names
    FOR v_i IN 1..v_days_n LOOP
      v_day_key := (p_days_of_week[v_i])::text;
      v_day_slot_names := ARRAY(
        SELECT regexp_replace(BTRIM(COALESCE(x, '')), '\s+', ' ', 'g')
        FROM jsonb_array_elements_text(COALESCE(p_slot_names_by_dow -> v_day_key, '[]'::jsonb)) AS x
      );
      v_slots_n := COALESCE(array_length(v_day_slot_names, 1), 0);
      IF v_slots_n < 1 OR v_slots_n > 10 THEN
        RETURN QUERY SELECT 400, 'Provide 1 to 10 slot names for each selected working day', NULL::jsonb; RETURN;
      END IF;
      IF EXISTS (SELECT 1 FROM unnest(v_day_slot_names) x(val) WHERE val IS NULL OR val = '') THEN
        RETURN QUERY SELECT 400, 'All slot names are required', NULL::jsonb; RETURN;
      END IF;
      SELECT COUNT(DISTINCT LOWER(val)) INTO v_distinct_n FROM unnest(v_day_slot_names) x(val);
      IF v_distinct_n <> v_slots_n THEN
        RETURN QUERY SELECT 400, 'Slot names must be unique (case-insensitive)', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  END IF;

  IF p_scope = 'section' THEN
    FOREACH v_sid IN ARRAY v_section_ids LOOP
      INSERT INTO attendance_patterns (
        id,
        name,
        scope,
        class_id,
        section_id,
        batch_id,
        start_date,
        end_date,
        is_active,
        created_by
      ) VALUES (
        uuid_generate_v4(),
        BTRIM(p_name),
        p_scope,
        p_class_id,
        v_sid,
        v_batch_id,
        p_start_date,
        p_end_date,
        TRUE,
        p_created_by
      )
      RETURNING id INTO v_id;

      v_ids := array_append(v_ids, v_id);

      -- days
      INSERT INTO attendance_pattern_days (id, pattern_id, day_of_week)
      SELECT uuid_generate_v4(), v_id, x.day
      FROM (
        SELECT DISTINCT unnest(p_days_of_week) AS day
      ) x;

      -- slots
      IF p_slot_names IS NULL AND p_slot_names_by_dow IS NULL THEN
        FOR v_i IN 1..v_slots_n LOOP
          INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
          VALUES (uuid_generate_v4(), v_id, NULL, v_i, v_slot_names[v_i], p_slot_times[v_i]);
        END LOOP;
      ELSIF v_same THEN
        FOR v_i IN 1..array_length(v_slot_names, 1) LOOP
          INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
          VALUES (
            uuid_generate_v4(),
            v_id,
            NULL,
            v_i,
            v_slot_names[v_i],
            CASE
              WHEN p_slot_times IS NOT NULL AND array_length(p_slot_times, 1) = array_length(v_slot_names, 1) THEN p_slot_times[v_i]
              ELSE NULL
            END
          );
        END LOOP;
      ELSE
        -- per-day slots
        FOR v_i IN 1..v_days_n LOOP
          v_day_key := (p_days_of_week[v_i])::text;
          v_day_slot_names := ARRAY(
            SELECT regexp_replace(BTRIM(COALESCE(x, '')), '\s+', ' ', 'g')
            FROM jsonb_array_elements_text(COALESCE(p_slot_names_by_dow -> v_day_key, '[]'::jsonb)) AS x
          );
          FOR v_j IN 1..array_length(v_day_slot_names, 1) LOOP
            INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
            VALUES (uuid_generate_v4(), v_id, p_days_of_week[v_i], v_j, v_day_slot_names[v_j], NULL);
          END LOOP;
        END LOOP;
      END IF;
    END LOOP;
  ELSE
    INSERT INTO attendance_patterns (
      id,
      name,
      scope,
      class_id,
      section_id,
      batch_id,
      start_date,
      end_date,
      is_active,
      created_by
    ) VALUES (
      uuid_generate_v4(),
      BTRIM(p_name),
      p_scope,
      CASE WHEN p_scope IN ('class','section') THEN p_class_id ELSE NULL END,
      CASE WHEN p_scope = 'section' THEN p_section_id ELSE NULL END,
      v_batch_id,
      p_start_date,
      p_end_date,
      TRUE,
      p_created_by
    )
    RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);

    -- days
    INSERT INTO attendance_pattern_days (id, pattern_id, day_of_week)
    SELECT uuid_generate_v4(), v_id, x.day
    FROM (
      SELECT DISTINCT unnest(p_days_of_week) AS day
    ) x;

    -- slots
    IF p_slot_names IS NULL AND p_slot_names_by_dow IS NULL THEN
      FOR v_i IN 1..v_slots_n LOOP
        INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
        VALUES (uuid_generate_v4(), v_id, NULL, v_i, v_slot_names[v_i], p_slot_times[v_i]);
      END LOOP;
    ELSIF v_same THEN
      FOR v_i IN 1..array_length(v_slot_names, 1) LOOP
        INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
        VALUES (
          uuid_generate_v4(),
          v_id,
          NULL,
          v_i,
          v_slot_names[v_i],
          CASE
            WHEN p_slot_times IS NOT NULL AND array_length(p_slot_times, 1) = array_length(v_slot_names, 1) THEN p_slot_times[v_i]
            ELSE NULL
          END
        );
      END LOOP;
    ELSE
      FOR v_i IN 1..v_days_n LOOP
        v_day_key := (p_days_of_week[v_i])::text;
        v_day_slot_names := ARRAY(
          SELECT regexp_replace(BTRIM(COALESCE(x, '')), '\s+', ' ', 'g')
          FROM jsonb_array_elements_text(COALESCE(p_slot_names_by_dow -> v_day_key, '[]'::jsonb)) AS x
        );
        FOR v_j IN 1..array_length(v_day_slot_names, 1) LOOP
          INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
          VALUES (uuid_generate_v4(), v_id, p_days_of_week[v_i], v_j, v_day_slot_names[v_j], NULL);
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 201,
         'Attendance pattern created successfully',
         jsonb_build_object(
           'id', CASE WHEN COALESCE(array_length(v_ids, 1), 0) = 1 THEN v_ids[1] ELSE NULL END,
           'ids', to_jsonb(v_ids),
           'count', COALESCE(array_length(v_ids, 1), 0)
         );
EXCEPTION
  WHEN exclusion_violation THEN
    v_conflict_msg := public.atr_attendance_pattern_conflict_message(
      p_scope,
      p_class_id,
      p_section_id,
      CASE WHEN p_scope = 'section' THEN v_section_ids ELSE NULL END,
      p_start_date,
      p_end_date
    );
    RETURN QUERY
    SELECT 409,
           COALESCE(
             v_conflict_msg,
             'An active pattern already exists for this scope and overlapping date range'
           ),
           NULL::jsonb;
    RETURN;
  WHEN unique_violation THEN
    IF SQLERRM ILIKE '%attendance_pattern_slots%' OR SQLERRM ILIKE '%uq_att_pat_slots%' THEN
      RETURN QUERY
      SELECT 400,
             'Invalid slot setup for one or more working days. Use unique slot names per day and avoid duplicate slot order.',
             NULL::jsonb;
      RETURN;
    END IF;
    v_conflict_msg := public.atr_attendance_pattern_conflict_message(
      p_scope,
      p_class_id,
      p_section_id,
      CASE WHEN p_scope = 'section' THEN v_section_ids ELSE NULL END,
      p_start_date,
      p_end_date
    );
    RETURN QUERY
    SELECT 409,
           COALESCE(
             v_conflict_msg,
             'An active pattern already exists for this scope and overlapping date range'
           ),
           NULL::jsonb;
    RETURN;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_get_attendance_pattern(
  p_pattern_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_pattern_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Pattern id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM attendance_patterns WHERE id = p_pattern_id) THEN
    RETURN QUERY SELECT 404, 'Attendance pattern not found', NULL::jsonb; RETURN;
  END IF;

  RETURN QUERY
  SELECT
    200,
    'Attendance pattern fetched successfully',
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'scope', p.scope,
      'class_id', p.class_id,
      'section_id', p.section_id,
      'start_date', p.start_date,
      'end_date', p.end_date,
      'is_active', p.is_active,
      'created_by', p.created_by,
      'updated_by', p.updated_by,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'days_of_week', COALESCE(
        (SELECT jsonb_agg(d.day_of_week ORDER BY d.day_of_week)
         FROM attendance_pattern_days d
         WHERE d.pattern_id = p.id),
        '[]'::jsonb
      ),
      'same_slots_all_days', NOT EXISTS (
        SELECT 1 FROM attendance_pattern_slots s
        WHERE s.pattern_id = p.id AND s.day_of_week IS NOT NULL
      ),
      'slots_global', COALESCE(
        (
          SELECT jsonb_agg(
                   jsonb_build_object(
                     'slot_index', s.slot_index,
                     'slot_name', s.slot_name,
                     'slot_time', CASE WHEN s.slot_time IS NULL THEN NULL ELSE to_char(s.slot_time, 'HH24:MI') END
                   )
                   ORDER BY s.slot_index
                 )
          FROM attendance_pattern_slots s
          WHERE s.pattern_id = p.id AND s.day_of_week IS NULL
        ),
        '[]'::jsonb
      ),
      'slots_by_dow', COALESCE(
        (
          SELECT jsonb_object_agg(dow_key, slots_arr)
          FROM (
            SELECT
              (s.day_of_week)::text AS dow_key,
              jsonb_agg(
                jsonb_build_object(
                  'slot_index', s.slot_index,
                  'slot_name', s.slot_name,
                  'slot_time', CASE WHEN s.slot_time IS NULL THEN NULL ELSE to_char(s.slot_time, 'HH24:MI') END
                )
                ORDER BY s.slot_index
              ) AS slots_arr
            FROM attendance_pattern_slots s
            WHERE s.pattern_id = p.id AND s.day_of_week IS NOT NULL
            GROUP BY s.day_of_week
          ) x
        ),
        '{}'::jsonb
      ),
      'slot_times', COALESCE(
        (
          SELECT jsonb_agg(to_char(s.slot_time, 'HH24:MI') ORDER BY s.slot_index)
          FROM attendance_pattern_slots s
          WHERE s.pattern_id = p.id AND s.day_of_week IS NULL AND s.slot_time IS NOT NULL
        ),
        '[]'::jsonb
      )
    )
  FROM attendance_patterns p
  WHERE p.id = p_pattern_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_list_attendance_patterns(
  p_search TEXT DEFAULT NULL,
  p_scope VARCHAR DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    200,
    'Attendance patterns fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      p.id,
      p.name,
      p.scope,
      p.class_id,
      c.name AS class_name,
      p.section_id,
      s.section_code AS section_name,
      p.batch_id,
      p.start_date,
      p.end_date,
      p.is_active,
      p.created_at,
      p.updated_at,
      CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM attendance_pattern_slots ps
          WHERE ps.pattern_id = p.id AND ps.day_of_week IS NOT NULL
        )
        THEN (SELECT COUNT(*) FROM attendance_pattern_slots ps WHERE ps.pattern_id = p.id AND ps.day_of_week IS NULL)
        ELSE NULL
      END AS slots_per_day,
      COALESCE(
        (SELECT jsonb_agg(d.day_of_week ORDER BY d.day_of_week)
         FROM attendance_pattern_days d
         WHERE d.pattern_id = p.id),
        '[]'::jsonb
      ) AS days_of_week,
      NOT EXISTS (
        SELECT 1 FROM attendance_pattern_slots ps
        WHERE ps.pattern_id = p.id AND ps.day_of_week IS NOT NULL
      ) AS same_slots_all_days,
      COALESCE(
        (
          SELECT jsonb_agg(
                   jsonb_build_object(
                     'slot_index', ps.slot_index,
                     'slot_name', ps.slot_name,
                     'slot_time', CASE WHEN ps.slot_time IS NULL THEN NULL ELSE to_char(ps.slot_time, 'HH24:MI') END
                   )
                   ORDER BY ps.slot_index
                 )
          FROM attendance_pattern_slots ps
          WHERE ps.pattern_id = p.id AND ps.day_of_week IS NULL
        ),
        '[]'::jsonb
      ) AS slots_global,
      COALESCE(
        (
          SELECT jsonb_object_agg(dow_key, slots_arr)
          FROM (
            SELECT
              (ps.day_of_week)::text AS dow_key,
              jsonb_agg(
                jsonb_build_object(
                  'slot_index', ps.slot_index,
                  'slot_name', ps.slot_name,
                  'slot_time', CASE WHEN ps.slot_time IS NULL THEN NULL ELSE to_char(ps.slot_time, 'HH24:MI') END
                )
                ORDER BY ps.slot_index
              ) AS slots_arr
            FROM attendance_pattern_slots ps
            WHERE ps.pattern_id = p.id AND ps.day_of_week IS NOT NULL
            GROUP BY ps.day_of_week
          ) y
        ),
        '{}'::jsonb
      ) AS slots_by_dow,
      COALESCE(
        (SELECT jsonb_agg(to_char(ps.slot_time, 'HH24:MI') ORDER BY ps.slot_index)
         FROM attendance_pattern_slots ps
         WHERE ps.pattern_id = p.id AND ps.day_of_week IS NULL AND ps.slot_time IS NOT NULL),
        '[]'::jsonb
      ) AS slot_times
    FROM attendance_patterns p
    LEFT JOIN classes c ON c.id = p.class_id
    LEFT JOIN sections s ON s.id = p.section_id
    WHERE
      (p_search IS NULL OR BTRIM(p_search) = '' OR
        LOWER(p.name) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(p.scope) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(COALESCE(c.name, '')) LIKE '%' || LOWER(BTRIM(p_search)) || '%' OR
        LOWER(COALESCE(s.section_code, '')) LIKE '%' || LOWER(BTRIM(p_search)) || '%'
      )
      AND (p_scope IS NULL OR BTRIM(p_scope) = '' OR p.scope = p_scope)
      AND (p_class_id IS NULL OR p.class_id = p_class_id)
      AND (p_section_id IS NULL OR p.section_id = p_section_id)
      AND (p_is_active IS NULL OR p.is_active = p_is_active)
  ) x;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_update_attendance_pattern(
  p_pattern_id UUID,
  p_name VARCHAR DEFAULT NULL,
  p_scope VARCHAR DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_days_of_week INT[] DEFAULT NULL,
  p_slot_times TIME[] DEFAULT NULL,
  p_slot_names TEXT[] DEFAULT NULL,
  p_same_slots_all_days BOOLEAN DEFAULT NULL,
  p_slot_names_by_dow JSONB DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope VARCHAR;
  v_class_id UUID;
  v_section_id UUID;
  v_start DATE;
  v_end DATE;
  v_days_n INT;
  v_slots_n INT;
  v_section_class_id UUID;
  v_i INT;
  v_same BOOLEAN;
  v_slot_names TEXT[];
  v_day_slot_names TEXT[];
  v_day_key TEXT;
  v_distinct_n INT;
  v_j INT;
  v_effective_days INT[];
BEGIN
  IF p_pattern_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Pattern id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM attendance_patterns WHERE id = p_pattern_id) THEN
    RETURN QUERY SELECT 404, 'Attendance pattern not found', NULL::jsonb; RETURN;
  END IF;

  SELECT scope, class_id, section_id, start_date, end_date
  INTO v_scope, v_class_id, v_section_id, v_start, v_end
  FROM attendance_patterns
  WHERE id = p_pattern_id;

  IF p_scope IS NOT NULL THEN
    IF p_scope NOT IN ('global','class','section') THEN
      RETURN QUERY SELECT 400, 'Scope must be one of: global, class, section', NULL::jsonb; RETURN;
    END IF;
    v_scope := p_scope;
  END IF;

  IF p_start_date IS NOT NULL THEN v_start := p_start_date; END IF;
  IF p_end_date IS NOT NULL THEN v_end := p_end_date; END IF;
  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN QUERY SELECT 400, 'Start date and end date are required', NULL::jsonb; RETURN;
  END IF;
  IF v_end < v_start THEN
    RETURN QUERY SELECT 400, 'End date must be on or after start date', NULL::jsonb; RETURN;
  END IF;

  -- Apply class/section changes (or keep existing)
  IF p_class_id IS NOT NULL THEN v_class_id := p_class_id; END IF;
  IF p_section_id IS NOT NULL THEN v_section_id := p_section_id; END IF;

  IF v_scope IN ('class','section') AND v_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Class is required for class/section scope', NULL::jsonb; RETURN;
  END IF;
  IF v_scope = 'section' AND v_section_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Section is required for section scope', NULL::jsonb; RETURN;
  END IF;

  IF v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes WHERE id = v_class_id) THEN
    RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
  END IF;

  IF v_section_id IS NOT NULL THEN
    SELECT class_id INTO v_section_class_id FROM sections WHERE id = v_section_id;
    IF v_section_class_id IS NULL THEN
      RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
    END IF;
    IF v_class_id IS NOT NULL AND v_section_class_id <> v_class_id THEN
      RETURN QUERY SELECT 400, 'Section does not belong to selected class', NULL::jsonb; RETURN;
    END IF;
  END IF;

  IF p_days_of_week IS NOT NULL THEN
    v_days_n := COALESCE(array_length(p_days_of_week, 1), 0);
    IF v_days_n < 1 THEN
      RETURN QUERY SELECT 400, 'Select at least one day of week', NULL::jsonb; RETURN;
    END IF;
    FOR v_i IN 1..v_days_n LOOP
      IF p_days_of_week[v_i] IS NULL OR p_days_of_week[v_i] < 0 OR p_days_of_week[v_i] > 6 THEN
        RETURN QUERY SELECT 400, 'Days of week must be between 0 (Sun) and 6 (Sat)', NULL::jsonb; RETURN;
      END IF;
    END LOOP;
  END IF;

  -- Effective working days for per-day slots validation
  IF p_days_of_week IS NOT NULL THEN
    v_effective_days := p_days_of_week;
  ELSE
    SELECT COALESCE(array_agg(d.day_of_week ORDER BY d.day_of_week), ARRAY[]::int[])
    INTO v_effective_days
    FROM attendance_pattern_days d
    WHERE d.pattern_id = p_pattern_id;
  END IF;
  v_days_n := COALESCE(array_length(v_effective_days, 1), 0);

  -- Slot model update:
  -- - If only p_slot_times is provided (legacy), keep legacy validation.
  -- - If any of new slot params are provided, rebuild slots using new rules.
  IF p_slot_names IS NULL AND p_slot_names_by_dow IS NULL AND p_same_slots_all_days IS NULL THEN
    IF p_slot_times IS NOT NULL THEN
      v_slots_n := COALESCE(array_length(p_slot_times, 1), 0);
      IF v_slots_n < 1 OR v_slots_n > 10 THEN
        RETURN QUERY SELECT 400, 'Provide 1 to 10 slot times', NULL::jsonb; RETURN;
      END IF;
      FOR v_i IN 2..v_slots_n LOOP
        IF p_slot_times[v_i] IS NULL OR p_slot_times[v_i-1] IS NULL THEN
          RETURN QUERY SELECT 400, 'All slot times are required', NULL::jsonb; RETURN;
        END IF;
        IF p_slot_times[v_i] <= p_slot_times[v_i-1] THEN
          RETURN QUERY SELECT 400, 'Slot times must be strictly increasing (no duplicates)', NULL::jsonb; RETURN;
        END IF;
      END LOOP;
    END IF;
  ELSE
    v_same := COALESCE(
      p_same_slots_all_days,
      CASE WHEN p_slot_names_by_dow IS NOT NULL THEN FALSE ELSE TRUE END
    );
    IF v_same THEN
      v_slots_n := COALESCE(array_length(p_slot_names, 1), 0);
      IF v_slots_n < 1 OR v_slots_n > 10 THEN
        RETURN QUERY SELECT 400, 'Provide 1 to 10 slot names', NULL::jsonb; RETURN;
      END IF;
      v_slot_names := ARRAY[]::text[];
      FOR v_i IN 1..v_slots_n LOOP
        v_slot_names := array_append(v_slot_names, regexp_replace(BTRIM(COALESCE(p_slot_names[v_i], '')), '\s+', ' ', 'g'));
      END LOOP;
      IF EXISTS (SELECT 1 FROM unnest(v_slot_names) x(val) WHERE val IS NULL OR val = '') THEN
        RETURN QUERY SELECT 400, 'All slot names are required', NULL::jsonb; RETURN;
      END IF;
      SELECT COUNT(DISTINCT LOWER(val)) INTO v_distinct_n FROM unnest(v_slot_names) x(val);
      IF v_distinct_n <> v_slots_n THEN
        RETURN QUERY SELECT 400, 'Slot names must be unique (case-insensitive)', NULL::jsonb; RETURN;
      END IF;
      IF p_slot_times IS NOT NULL AND array_length(p_slot_times, 1) IS NOT NULL THEN
        IF array_length(p_slot_times, 1) <> v_slots_n THEN
          RETURN QUERY SELECT 400, 'slot_times length must match slot_names length when provided', NULL::jsonb; RETURN;
        END IF;
        FOR v_i IN 2..v_slots_n LOOP
          IF p_slot_times[v_i] IS NULL OR p_slot_times[v_i-1] IS NULL THEN
            RETURN QUERY SELECT 400, 'All slot times are required when provided', NULL::jsonb; RETURN;
          END IF;
          IF p_slot_times[v_i] <= p_slot_times[v_i-1] THEN
            RETURN QUERY SELECT 400, 'Slot times must be strictly increasing (no duplicates)', NULL::jsonb; RETURN;
          END IF;
        END LOOP;
      END IF;
    ELSE
      IF v_days_n < 1 THEN
        RETURN QUERY SELECT 400, 'Select at least one day of week', NULL::jsonb; RETURN;
      END IF;
      IF p_slot_names_by_dow IS NULL THEN
        RETURN QUERY SELECT 400, 'slot_names_by_dow is required when same_slots_all_days is false', NULL::jsonb; RETURN;
      END IF;
      FOR v_i IN 1..v_days_n LOOP
        v_day_key := (v_effective_days[v_i])::text;
        v_day_slot_names := ARRAY(
          SELECT regexp_replace(BTRIM(COALESCE(x, '')), '\s+', ' ', 'g')
          FROM jsonb_array_elements_text(COALESCE(p_slot_names_by_dow -> v_day_key, '[]'::jsonb)) AS x
        );
        v_slots_n := COALESCE(array_length(v_day_slot_names, 1), 0);
        IF v_slots_n < 1 OR v_slots_n > 10 THEN
          RETURN QUERY SELECT 400, 'Provide 1 to 10 slot names for each selected working day', NULL::jsonb; RETURN;
        END IF;
        IF EXISTS (SELECT 1 FROM unnest(v_day_slot_names) x(val) WHERE val IS NULL OR val = '') THEN
          RETURN QUERY SELECT 400, 'All slot names are required', NULL::jsonb; RETURN;
        END IF;
        SELECT COUNT(DISTINCT LOWER(val)) INTO v_distinct_n FROM unnest(v_day_slot_names) x(val);
        IF v_distinct_n <> v_slots_n THEN
          RETURN QUERY SELECT 400, 'Slot names must be unique (case-insensitive)', NULL::jsonb; RETURN;
        END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE attendance_patterns
  SET
    name = COALESCE(NULLIF(BTRIM(p_name), ''), name),
    scope = v_scope,
    class_id = CASE WHEN v_scope IN ('class','section') THEN v_class_id ELSE NULL END,
    section_id = CASE WHEN v_scope = 'section' THEN v_section_id ELSE NULL END,
    start_date = v_start,
    end_date = v_end,
    is_active = COALESCE(p_is_active, is_active),
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_pattern_id;

  IF p_days_of_week IS NOT NULL THEN
    DELETE FROM attendance_pattern_days WHERE pattern_id = p_pattern_id;
    INSERT INTO attendance_pattern_days (id, pattern_id, day_of_week)
    SELECT uuid_generate_v4(), p_pattern_id, x.day
    FROM (SELECT DISTINCT unnest(p_days_of_week) AS day) x;
  END IF;

  IF p_slot_times IS NOT NULL OR p_slot_names IS NOT NULL OR p_slot_names_by_dow IS NOT NULL OR p_same_slots_all_days IS NOT NULL THEN
    DELETE FROM attendance_pattern_slots WHERE pattern_id = p_pattern_id;

    IF p_slot_names IS NULL AND p_slot_names_by_dow IS NULL AND p_same_slots_all_days IS NULL THEN
      -- legacy update using times (backfills names)
      FOR v_i IN 1..COALESCE(array_length(p_slot_times, 1), 0) LOOP
        INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
        VALUES (uuid_generate_v4(), p_pattern_id, NULL, v_i, 'Slot ' || v_i::text, p_slot_times[v_i]);
      END LOOP;
    ELSE
      v_same := COALESCE(
        p_same_slots_all_days,
        CASE WHEN p_slot_names_by_dow IS NOT NULL THEN FALSE ELSE TRUE END
      );
      IF v_same THEN
        v_slot_names := ARRAY[]::text[];
        v_slots_n := COALESCE(array_length(p_slot_names, 1), 0);
        FOR v_i IN 1..v_slots_n LOOP
          v_slot_names := array_append(v_slot_names, regexp_replace(BTRIM(COALESCE(p_slot_names[v_i], '')), '\s+', ' ', 'g'));
        END LOOP;
        FOR v_i IN 1..array_length(v_slot_names, 1) LOOP
          INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
          VALUES (
            uuid_generate_v4(),
            p_pattern_id,
            NULL,
            v_i,
            v_slot_names[v_i],
            CASE
              WHEN p_slot_times IS NOT NULL AND array_length(p_slot_times, 1) = array_length(v_slot_names, 1) THEN p_slot_times[v_i]
              ELSE NULL
            END
          );
        END LOOP;
      ELSE
        FOR v_i IN 1..v_days_n LOOP
          v_day_key := (v_effective_days[v_i])::text;
          v_day_slot_names := ARRAY(
            SELECT regexp_replace(BTRIM(COALESCE(x, '')), '\s+', ' ', 'g')
            FROM jsonb_array_elements_text(COALESCE(p_slot_names_by_dow -> v_day_key, '[]'::jsonb)) AS x
          );
          FOR v_j IN 1..array_length(v_day_slot_names, 1) LOOP
            INSERT INTO attendance_pattern_slots (id, pattern_id, day_of_week, slot_index, slot_name, slot_time)
            VALUES (uuid_generate_v4(), p_pattern_id, v_effective_days[v_i], v_j, v_day_slot_names[v_j], NULL);
          END LOOP;
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT 200, 'Attendance pattern updated successfully', jsonb_build_object('id', p_pattern_id);
EXCEPTION
  WHEN unique_violation OR exclusion_violation THEN
    RETURN QUERY SELECT 409, 'An active pattern already exists for this scope and overlapping date range', NULL::jsonb; RETURN;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


-- Version an attendance pattern:
-- - Archive (deactivate) the old pattern
-- - Create a new active pattern effective from tomorrow (CURRENT_DATE + 1)
-- Notes:
-- - Single transaction: on any error, the old pattern remains active.
-- - Caller supplies the new desired config; start_date is fixed to tomorrow.
CREATE OR REPLACE FUNCTION public.atr_version_attendance_pattern(
  p_old_pattern_id UUID,
  p_name VARCHAR,
  p_scope VARCHAR,
  p_class_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_days_of_week INT[] DEFAULT NULL,
  p_slot_names TEXT[] DEFAULT NULL,
  p_same_slots_all_days BOOLEAN DEFAULT TRUE,
  p_slot_names_by_dow JSONB DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_start DATE := (CURRENT_DATE + 1);
  v_new_end DATE := NULL;
  v_create_status INT := NULL;
  v_create_msg TEXT := NULL;
  v_create_data JSONB := NULL;
  v_new_id UUID := NULL;
BEGIN
  IF p_old_pattern_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Old pattern id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM attendance_patterns WHERE id = p_old_pattern_id) THEN
    RETURN QUERY SELECT 404, 'Attendance pattern not found', NULL::jsonb; RETURN;
  END IF;

  v_new_end := GREATEST(COALESCE(p_end_date, v_new_start), v_new_start);

  -- Archive old pattern first to avoid overlap constraints.
  UPDATE attendance_patterns
  SET is_active = FALSE, updated_by = p_updated_by, updated_at = NOW()
  WHERE id = p_old_pattern_id;

  SELECT c.status_code, c.message, c.data
  INTO v_create_status, v_create_msg, v_create_data
  FROM public.atr_create_attendance_pattern(
    p_name,
    p_scope,
    v_new_start,
    v_new_end,
    p_class_id,
    p_section_id,
    NULL, -- p_section_ids (versioning uses single section_id)
    p_days_of_week,
    NULL, -- p_slot_times (legacy / optional)
    p_slot_names,
    p_same_slots_all_days,
    p_slot_names_by_dow,
    p_updated_by -- created_by
  ) c;

  IF v_create_status < 200 OR v_create_status >= 300 THEN
    -- Force rollback so the old pattern stays active.
    RAISE EXCEPTION '%', COALESCE(v_create_msg, 'Failed to create new pattern');
  END IF;

  v_new_id := NULLIF(v_create_data->>'id', '')::uuid;

  RETURN QUERY
  SELECT
    201,
    'Attendance pattern version created successfully',
    jsonb_build_object(
      'old_id', p_old_pattern_id,
      'new_id', v_new_id,
      'effective_from', v_new_start
    );
EXCEPTION
  WHEN unique_violation OR exclusion_violation THEN
    RETURN QUERY SELECT 409, 'An active pattern already exists for this scope and overlapping date range', NULL::jsonb; RETURN;
  WHEN OTHERS THEN
    IF v_create_status IS NOT NULL AND (v_create_status < 200 OR v_create_status >= 300) THEN
      RETURN QUERY SELECT v_create_status, COALESCE(v_create_msg, 'Failed to create new pattern'), NULL::jsonb; RETURN;
    END IF;
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb; RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_deactivate_attendance_pattern(
  p_pattern_id UUID,
  p_updated_by UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_pattern_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Pattern id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM attendance_patterns WHERE id = p_pattern_id) THEN
    RETURN QUERY SELECT 404, 'Attendance pattern not found', NULL::jsonb; RETURN;
  END IF;

  UPDATE attendance_patterns
  SET is_active = FALSE, updated_by = p_updated_by, updated_at = NOW()
  WHERE id = p_pattern_id;

  RETURN QUERY SELECT 200, 'Attendance pattern deactivated successfully', jsonb_build_object('id', p_pattern_id);
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_delete_attendance_pattern(
  p_pattern_id UUID
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope VARCHAR;
  v_class_id UUID;
  v_section_id UUID;
  v_batch_id UUID;
  v_start DATE;
  v_end DATE;
  v_section_ids UUID[];
  v_abs_deleted INT := 0;
  v_patterns_deleted INT := 0;
BEGIN
  IF p_pattern_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Pattern id is required', NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM attendance_patterns WHERE id = p_pattern_id) THEN
    RETURN QUERY SELECT 404, 'Attendance pattern not found', NULL::jsonb; RETURN;
  END IF;

  SELECT scope, class_id, section_id, batch_id, start_date, end_date
  INTO v_scope, v_class_id, v_section_id, v_batch_id, v_start, v_end
  FROM attendance_patterns
  WHERE id = p_pattern_id;

  IF v_scope = 'section' AND v_batch_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT p.section_id), ARRAY[]::uuid[])
    INTO v_section_ids
    FROM attendance_patterns p
    WHERE p.batch_id = v_batch_id
      AND p.scope = 'section'
      AND p.class_id IS NOT DISTINCT FROM v_class_id;
  ELSIF v_scope = 'section' AND v_section_id IS NOT NULL THEN
    v_section_ids := ARRAY[v_section_id];
  END IF;

  -- If this pattern was created as part of a batch (multi-section create), delete the whole batch.
  -- This prevents leftover section patterns from blocking re-creation in the same date range.
  IF v_batch_id IS NOT NULL THEN
    -- Delete recorded attendance (absences) that fall under this pattern batch's scope + date range.
    -- Note: attendance is stored as absences-only rows (student_absences). This is irreversible.
    IF v_scope = 'global' THEN
      DELETE FROM student_absences a
      WHERE a.absent_date BETWEEN v_start AND v_end;
      GET DIAGNOSTICS v_abs_deleted = ROW_COUNT;
    ELSIF v_scope = 'class' THEN
      DELETE FROM student_absences a
      USING students s
      WHERE s.id = a.student_id
        AND s.class_id = v_class_id
        AND a.absent_date BETWEEN v_start AND v_end;
      GET DIAGNOSTICS v_abs_deleted = ROW_COUNT;
    ELSIF v_scope = 'section' THEN
      -- For section batches, delete absences for all sections in the batch.
      DELETE FROM student_absences a
      USING students s
      WHERE s.id = a.student_id
        AND s.class_id = v_class_id
        AND s.section_id IN (
          SELECT p.section_id
          FROM attendance_patterns p
          WHERE p.batch_id = v_batch_id
            AND p.scope = 'section'
            AND p.class_id = v_class_id
        )
        AND a.absent_date BETWEEN v_start AND v_end;
      GET DIAGNOSTICS v_abs_deleted = ROW_COUNT;
    END IF;

    DELETE FROM attendance_patterns WHERE batch_id = v_batch_id;
    GET DIAGNOSTICS v_patterns_deleted = ROW_COUNT;
  ELSE
    -- Legacy: single pattern delete
    IF v_scope = 'global' THEN
      DELETE FROM student_absences a
      WHERE a.absent_date BETWEEN v_start AND v_end;
      GET DIAGNOSTICS v_abs_deleted = ROW_COUNT;
    ELSIF v_scope = 'class' THEN
      DELETE FROM student_absences a
      USING students s
      WHERE s.id = a.student_id
        AND s.class_id = v_class_id
        AND a.absent_date BETWEEN v_start AND v_end;
      GET DIAGNOSTICS v_abs_deleted = ROW_COUNT;
    ELSIF v_scope = 'section' THEN
      DELETE FROM student_absences a
      USING students s
      WHERE s.id = a.student_id
        AND s.class_id = v_class_id
        AND s.section_id = v_section_id
        AND a.absent_date BETWEEN v_start AND v_end;
      GET DIAGNOSTICS v_abs_deleted = ROW_COUNT;
    END IF;

    DELETE FROM attendance_patterns WHERE id = p_pattern_id;
    GET DIAGNOSTICS v_patterns_deleted = ROW_COUNT;
  END IF;

  PERFORM public.atr_purge_inactive_attendance_patterns(
    v_scope,
    v_class_id,
    v_section_id,
    v_section_ids,
    v_start,
    v_end
  );

  RETURN QUERY
  SELECT
    200,
    'Attendance pattern deleted successfully',
    jsonb_build_object(
      'id', p_pattern_id,
      'batch_id', v_batch_id,
      'deleted_patterns', COALESCE(v_patterns_deleted, 0),
      'deleted_absences', COALESCE(v_abs_deleted, 0)
    );
END;
$$;


-- Resolve applicable pattern for a given class/section + date.
-- Precedence: section > class > global
CREATE OR REPLACE FUNCTION public.atr_resolve_attendance_pattern(
  p_class_id UUID,
  p_date DATE,
  p_section_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_id_any UUID;
BEGIN
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'Class is required', NULL::jsonb; RETURN;
  END IF;
  IF p_date IS NULL THEN
    RETURN QUERY SELECT 400, 'Date is required', NULL::jsonb; RETURN;
  END IF;

  -- 1) section pattern
  IF p_section_id IS NOT NULL THEN
    -- If a section pattern exists for the date range, it should control the day-of-week too.
    -- Do NOT fall back to class/global if the section pattern excludes that day.
    SELECT p.id INTO v_id_any
    FROM attendance_patterns p
  WHERE (p.is_active = TRUE OR p_date < CURRENT_DATE)
      AND p.scope = 'section'
      AND p.class_id = p_class_id
      AND p.section_id = p_section_id
      AND p_date BETWEEN p.start_date AND p.end_date
    ORDER BY p.start_date DESC, p.created_at DESC
    LIMIT 1;

    IF v_id_any IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM attendance_pattern_days d
        WHERE d.pattern_id = v_id_any
          AND d.day_of_week = EXTRACT(DOW FROM p_date)::int
      ) THEN
        RETURN QUERY SELECT * FROM public.atr_get_attendance_pattern(v_id_any); RETURN;
      END IF;
      RETURN QUERY SELECT 404, 'No attendance for this day. Please select another day.', NULL::jsonb; RETURN;
    END IF;
  END IF;

  -- 2) class pattern
  -- Same rule for class patterns: if one exists for the date range, it controls the weekday.
  SELECT p.id INTO v_id_any
  FROM attendance_patterns p
  WHERE (p.is_active = TRUE OR p_date < CURRENT_DATE)
    AND p.scope = 'class'
    AND p.class_id = p_class_id
    AND p_date BETWEEN p.start_date AND p.end_date
  ORDER BY p.start_date DESC, p.created_at DESC
  LIMIT 1;

  IF v_id_any IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM attendance_pattern_days d
      WHERE d.pattern_id = v_id_any
        AND d.day_of_week = EXTRACT(DOW FROM p_date)::int
    ) THEN
      RETURN QUERY SELECT * FROM public.atr_get_attendance_pattern(v_id_any); RETURN;
    END IF;
    RETURN QUERY SELECT 404, 'No attendance for this day. Please select another day.', NULL::jsonb; RETURN;
  END IF;

  -- 3) global pattern
  SELECT p.id INTO v_id
  FROM attendance_patterns p
  WHERE (p.is_active = TRUE OR p_date < CURRENT_DATE)
    AND p.scope = 'global'
    AND p_date BETWEEN p.start_date AND p.end_date
    AND EXISTS (
      SELECT 1 FROM attendance_pattern_days d
      WHERE d.pattern_id = p.id
        AND d.day_of_week = EXTRACT(DOW FROM p_date)::int
    )
  ORDER BY p.start_date DESC, p.created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.atr_get_attendance_pattern(v_id); RETURN;
  END IF;

  RETURN QUERY SELECT 404, 'No attendance for this day. Please select another day.', NULL::jsonb;
END;
$$;

