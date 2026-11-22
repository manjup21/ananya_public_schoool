-- ============================================================
-- CLASSES FUNCTIONS
-- Synced from database: 2026-04-10T11:30:12.632Z
-- ============================================================
CREATE OR REPLACE FUNCTION public.atr_create_class(p_name character varying, p_created_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_class RECORD;
BEGIN
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RETURN QUERY SELECT 400, 'Class name is required', NULL; RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM classes WHERE LOWER(name) = LOWER(p_name)) THEN
        RETURN QUERY SELECT 409, 'Class already exists', NULL; RETURN;
    END IF;

    INSERT INTO classes (name, created_by)
    VALUES (p_name, p_created_by)
    RETURNING * INTO v_class;

    RETURN QUERY SELECT
        201,
        'Class created successfully',
        jsonb_build_object('id', v_class.id, 'name', v_class.name);

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$

CREATE OR REPLACE FUNCTION public.atr_update_class(p_class_id uuid, p_name character varying, p_updated_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_class RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
        RETURN QUERY SELECT 404, 'Class not found', NULL; RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM classes
        WHERE LOWER(name) = LOWER(p_name) AND id <> p_class_id
    ) THEN
        RETURN QUERY SELECT 409, 'Class name already exists', NULL; RETURN;
    END IF;

    UPDATE classes
    SET
        name = p_name,
        updated_by = p_updated_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_class_id
    RETURNING * INTO v_class;

    RETURN QUERY SELECT
        200,
        'Class updated successfully',
        jsonb_build_object('id', v_class.id, 'name', v_class.name);

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$

CREATE OR REPLACE FUNCTION public.atr_delete_class(p_class_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_section_count INT;
    v_student_count INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
        RETURN QUERY SELECT 404, 'Class not found', NULL; RETURN;
    END IF;

    SELECT COUNT(*) INTO v_student_count
    FROM students
    WHERE class_id = p_class_id;

    IF v_student_count > 0 THEN
        RETURN QUERY SELECT
            400,
            'Cannot delete class. Students exist for this class',
            jsonb_build_object('students_count', v_student_count);
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_section_count
    FROM sections WHERE class_id = p_class_id;

    IF v_section_count > 0 THEN
        RETURN QUERY SELECT
            400,
            'Cannot delete class. Sections exist for this class',
            jsonb_build_object('sections_count', v_section_count);
        RETURN;
    END IF;

    DELETE FROM classes WHERE id = p_class_id;

    RETURN QUERY SELECT 200, 'Class deleted successfully', NULL::jsonb;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$

CREATE OR REPLACE FUNCTION public.atr_get_classes()
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        200,
        'Classes fetched successfully',
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'sections', COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', s.id,
                                    'section', s.section_code
                                )
                                ORDER BY s.section_code
                            )
                            FROM sections s
                            WHERE s.class_id = c.id
                        ),
                        '[]'::jsonb
                    )
                )
                ORDER BY c.name
            ),
            '[]'::jsonb
        )
    FROM classes c;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$
