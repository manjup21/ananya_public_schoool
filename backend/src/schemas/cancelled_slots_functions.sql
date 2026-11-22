-- ============================================================
-- CANCELLED SLOTS FUNCTIONS
-- - Cancel a slot (mark class as not taken)
-- - Uncancel a slot (restore a cancelled class)
-- - Check if a slot is cancelled
-- ============================================================

CREATE OR REPLACE FUNCTION public.atr_cancel_slot(
  p_date DATE,
  p_slot_index INT,
  p_class_id UUID,
  p_section_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_reason TEXT;
BEGIN
  IF p_date IS NULL THEN
    RETURN QUERY SELECT 400, 'date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');

  INSERT INTO cancelled_slots (id, cancelled_date, slot_index, class_id, section_id, reason, cancelled_by)
  VALUES (
    uuid_generate_v4(),
    p_date,
    p_slot_index,
    p_class_id,
    p_section_id,
    v_reason,
    p_actor_user_id
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 201, 'Slot cancelled successfully',
    jsonb_build_object(
      'id', v_id,
      'cancelled_date', p_date,
      'slot_index', p_slot_index,
      'class_id', p_class_id,
      'section_id', p_section_id,
      'reason', v_reason
    );
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 409, 'This slot is already cancelled for the given class/section and date', NULL::jsonb;
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$$;


CREATE OR REPLACE FUNCTION public.atr_uncancel_slot(
  p_date DATE,
  p_slot_index INT,
  p_class_id UUID,
  p_section_id UUID DEFAULT NULL
)
RETURNS TABLE (status_code INT, message TEXT, data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_date IS NULL THEN
    RETURN QUERY SELECT 400, 'date is required', NULL::jsonb; RETURN;
  END IF;
  IF p_slot_index IS NULL OR p_slot_index < 1 OR p_slot_index > 10 THEN
    RETURN QUERY SELECT 400, 'slot_index must be between 1 and 10', NULL::jsonb; RETURN;
  END IF;
  IF p_class_id IS NULL THEN
    RETURN QUERY SELECT 400, 'class_id is required', NULL::jsonb; RETURN;
  END IF;

  DELETE FROM cancelled_slots
  WHERE cancelled_date = p_date
    AND slot_index = p_slot_index
    AND class_id = p_class_id
    AND (
      (p_section_id IS NULL AND section_id IS NULL)
      OR section_id = p_section_id
    );

  IF NOT FOUND THEN
    RETURN QUERY SELECT 404, 'No cancellation found for this slot', NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY SELECT 200, 'Slot restored successfully',
    jsonb_build_object(
      'cancelled_date', p_date,
      'slot_index', p_slot_index,
      'class_id', p_class_id,
      'section_id', p_section_id
    );
END;
$$;


-- Returns cancellation info if the slot is cancelled for the given class/section,
-- or for the whole class (section_id IS NULL).
CREATE OR REPLACE FUNCTION public.atr_is_slot_cancelled(
  p_date DATE,
  p_slot_index INT,
  p_class_id UUID,
  p_section_id UUID DEFAULT NULL
)
RETURNS TABLE (is_cancelled BOOLEAN, reason TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    TRUE AS is_cancelled,
    cs.reason
  FROM cancelled_slots cs
  WHERE cs.cancelled_date = p_date
    AND cs.slot_index = p_slot_index
    AND cs.class_id = p_class_id
    AND (
      cs.section_id IS NULL
      OR cs.section_id = p_section_id
    )
  LIMIT 1;
$$;
