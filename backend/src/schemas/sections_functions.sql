-- ============================================================
-- SECTIONS FUNCTIONS
-- Synced from database: 2026-04-10T11:30:12.634Z
-- ============================================================
CREATE OR REPLACE FUNCTION public.atr_create_section(p_class_id uuid, p_section_code character varying, p_created_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_section RECORD;
BEGIN
    IF p_section_code IS NULL OR TRIM(p_section_code) = '' THEN
        RETURN QUERY SELECT 400, 'Section code is required', NULL::jsonb; RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
        RETURN QUERY SELECT 404, 'Class not found', NULL::jsonb; RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM sections
        WHERE class_id = p_class_id AND UPPER(section_code) = UPPER(TRIM(p_section_code))
    ) THEN
        RETURN QUERY SELECT 409, 'Section already exists', NULL::jsonb; RETURN;
    END IF;

    INSERT INTO sections (class_id, section_code, created_by)
    VALUES (p_class_id, UPPER(TRIM(p_section_code)), p_created_by)
    RETURNING * INTO v_section;

    RETURN QUERY SELECT
        201,
        'Section created successfully',
        jsonb_build_object('id', v_section.id, 'section', v_section.section_code);

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_update_section(p_section_id uuid, p_section_code character varying, p_updated_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_class_id UUID;
    v_section RECORD;
BEGIN
    SELECT class_id INTO v_class_id FROM sections WHERE id = p_section_id;

    IF v_class_id IS NULL THEN
        RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM sections
        WHERE class_id = v_class_id
        AND UPPER(section_code) = UPPER(TRIM(p_section_code))
        AND id <> p_section_id
    ) THEN
        RETURN QUERY SELECT 409, 'Section already exists', NULL::jsonb; RETURN;
    END IF;

    UPDATE sections
    SET
        section_code = UPPER(TRIM(p_section_code)),
        updated_by = p_updated_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_section_id
    RETURNING * INTO v_section;

    RETURN QUERY SELECT
        200,
        'Section updated successfully',
        jsonb_build_object('id', v_section.id, 'section', v_section.section_code);

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_delete_section(p_section_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_student_count INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sections WHERE id = p_section_id) THEN
        RETURN QUERY SELECT 404, 'Section not found', NULL::jsonb; RETURN;
    END IF;

    SELECT COUNT(*) INTO v_student_count
    FROM students
    WHERE section_id = p_section_id;

    IF v_student_count > 0 THEN
        RETURN QUERY SELECT
            400,
            'Cannot delete section. Students exist for this section',
            jsonb_build_object('students_count', v_student_count);
        RETURN;
    END IF;

    DELETE FROM sections WHERE id = p_section_id;

    RETURN QUERY SELECT 200, 'Section deleted successfully', NULL::jsonb;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;
