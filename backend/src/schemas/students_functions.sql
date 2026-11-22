-- ============================================================
-- STUDENTS FUNCTIONS
-- Synced from database: 2026-04-10T11:30:12.645Z
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_student(p_gender character varying, p_first_name character varying, p_last_name character varying, p_date_of_birth date, p_roll_number character varying, p_class_id uuid, p_section_id uuid DEFAULT NULL::uuid, p_address_location text DEFAULT NULL::text, p_address_city character varying DEFAULT NULL::character varying, p_address_district character varying DEFAULT NULL::character varying, p_address_state character varying DEFAULT NULL::character varying, p_address_pin character varying DEFAULT NULL::character varying, p_father_name character varying DEFAULT NULL::character varying, p_mother_name character varying DEFAULT NULL::character varying, p_guardian_email character varying DEFAULT NULL::character varying, p_guardian_phone character varying DEFAULT NULL::character varying, p_emergency_contact_number character varying DEFAULT NULL::character varying, p_blood_group character varying DEFAULT NULL::character varying, p_residence_type character varying DEFAULT NULL::character varying, p_specialisation character varying DEFAULT NULL::character varying, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id UUID;
    v_section_class_id UUID;
BEGIN
    IF p_gender IS NULL OR p_gender NOT IN ('male', 'female', 'other') THEN
        RAISE EXCEPTION 'Gender is required';
    END IF;

    IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
        RAISE EXCEPTION 'First name is required';
    END IF;

    IF p_date_of_birth IS NULL THEN
        RAISE EXCEPTION 'Date of birth is required';
    END IF;

    IF p_roll_number IS NULL OR TRIM(p_roll_number) = '' THEN
        RAISE EXCEPTION 'Roll number is required';
    END IF;

    IF p_class_id IS NULL THEN
        RAISE EXCEPTION 'Class is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF p_section_id IS NOT NULL THEN
        SELECT class_id INTO v_section_class_id FROM sections WHERE id = p_section_id;
        IF v_section_class_id IS NULL THEN
            RAISE EXCEPTION 'Section not found';
        END IF;
        IF v_section_class_id <> p_class_id THEN
            RAISE EXCEPTION 'Section does not belong to selected class';
        END IF;
    END IF;

    IF p_father_name IS NULL OR TRIM(p_father_name) = '' THEN
        RAISE EXCEPTION 'Father name is required';
    END IF;

    IF p_guardian_phone IS NULL OR TRIM(p_guardian_phone) = '' THEN
        RAISE EXCEPTION 'Guardian phone is required';
    END IF;

    IF p_residence_type IS NULL OR p_residence_type NOT IN ('day_scholar', 'hosteller') THEN
        RAISE EXCEPTION 'Residence type is required';
    END IF;

    IF EXISTS (
        SELECT 1 FROM students
        WHERE is_deleted = FALSE
          AND LOWER(roll_number) = LOWER(TRIM(p_roll_number))
    ) THEN
        RAISE EXCEPTION 'Roll number already exists';
    END IF;

    INSERT INTO students (
        id,
        gender,
        first_name,
        last_name,
        date_of_birth,
        roll_number,
        class_id,
        section_id,
        address_location,
        address_city,
        address_district,
        address_state,
        address_pin,
        father_name,
        mother_name,
        guardian_email,
        guardian_phone,
        emergency_contact_number,
        blood_group,
        residence_type,
        specialisation,
        created_by
    )
    VALUES (
        uuid_generate_v4(),
        p_gender,
        TRIM(p_first_name),
        NULLIF(TRIM(p_last_name), ''),
        p_date_of_birth,
        TRIM(p_roll_number),
        p_class_id,
        p_section_id,
        p_address_location,
        p_address_city,
        p_address_district,
        p_address_state,
        p_address_pin,
        TRIM(p_father_name),
        NULLIF(TRIM(COALESCE(p_mother_name, '')), ''),
        p_guardian_email,
        TRIM(p_guardian_phone),
        p_emergency_contact_number,
        p_blood_group,
        p_residence_type,
        p_specialisation,
        p_created_by
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$function$;

-- List API return type extended for export (address + emergency). PostgreSQL requires
-- DROP before CREATE when OUT/RETURNS TABLE columns change.
DROP FUNCTION IF EXISTS public.atr_get_students(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_students(text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_students(p_search text DEFAULT NULL::text, p_class_id uuid DEFAULT NULL::uuid, p_section_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(
    id uuid,
    first_name character varying,
    last_name character varying,
    roll_number character varying,
    gender character varying,
    date_of_birth date,
    class_id uuid,
    section_id uuid,
    father_name character varying,
    mother_name character varying,
    guardian_phone character varying,
    residence_type character varying,
    emergency_contact_number character varying,
    address_location text,
    address_city character varying,
    address_district character varying,
    address_state character varying,
    address_pin character varying,
    photo_path character varying,
    is_active boolean,
    created_at timestamp with time zone
 )
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.first_name,
        s.last_name,
        s.roll_number,
        s.gender,
        s.date_of_birth,
        s.class_id,
        s.section_id,
        s.father_name,
        s.mother_name,
        s.guardian_phone,
        s.residence_type,
        s.emergency_contact_number,
        s.address_location,
        s.address_city,
        s.address_district,
        s.address_state,
        s.address_pin,
        s.photo_path,
        s.is_active,
        s.created_at
    FROM students s
    WHERE
        s.is_deleted = FALSE
        AND (p_class_id IS NULL OR s.class_id = p_class_id)
        AND (p_section_id IS NULL OR s.section_id = p_section_id)
        AND (

            p_search IS NULL
            OR s.roll_number ILIKE '%' || p_search || '%'
            OR BTRIM(CONCAT_WS(' ', s.first_name, s.last_name)) ILIKE '%' || p_search || '%'
            OR s.guardian_phone ILIKE '%' || p_search || '%'
        )
    ORDER BY s.roll_number ASC, s.first_name ASC, s.last_name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_by_id(p_id uuid)
 RETURNS students
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_student students;
BEGIN
    SELECT * INTO v_student
    FROM students
    WHERE id = p_id AND is_deleted = FALSE;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    RETURN v_student;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_student(p_id uuid, p_gender character varying, p_first_name character varying, p_last_name character varying, p_date_of_birth date, p_roll_number character varying, p_class_id uuid, p_section_id uuid, p_address_location text, p_address_city character varying, p_address_district character varying, p_address_state character varying, p_address_pin character varying, p_father_name character varying, p_mother_name character varying, p_guardian_email character varying, p_guardian_phone character varying, p_emergency_contact_number character varying, p_blood_group character varying, p_residence_type character varying, p_specialisation character varying, p_is_active boolean, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_section_class_id UUID;
    v_current_class_id UUID;
    v_current_section_id UUID;
    v_clear_section BOOLEAN := FALSE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM students WHERE id = p_id AND is_deleted = FALSE
    ) THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female', 'other') THEN
        RAISE EXCEPTION 'Invalid gender';
    END IF;

    IF p_residence_type IS NOT NULL AND p_residence_type NOT IN ('day_scholar', 'hosteller') THEN
        RAISE EXCEPTION 'Invalid residence type';
    END IF;

    IF p_blood_group IS NOT NULL AND p_blood_group NOT IN ('A+','A-','B+','B-','AB+','AB-','O+','O-') THEN
        RAISE EXCEPTION 'Invalid blood group';
    END IF;

    IF p_roll_number IS NOT NULL AND EXISTS (
        SELECT 1 FROM students
        WHERE is_deleted = FALSE
          AND LOWER(roll_number) = LOWER(TRIM(p_roll_number))
          AND id <> p_id
    ) THEN
        RAISE EXCEPTION 'Roll number already exists';
    END IF;

    IF p_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    SELECT class_id, section_id INTO v_current_class_id, v_current_section_id
    FROM students WHERE id = p_id;

    IF p_section_id IS NOT NULL THEN
        SELECT class_id INTO v_section_class_id FROM sections WHERE id = p_section_id;
        IF v_section_class_id IS NULL THEN
            RAISE EXCEPTION 'Section not found';
        END IF;
        IF v_section_class_id <> COALESCE(p_class_id, v_current_class_id) THEN
            RAISE EXCEPTION 'Section does not belong to the target class';
        END IF;
    ELSIF p_class_id IS NOT NULL AND v_current_section_id IS NOT NULL THEN
        SELECT class_id INTO v_section_class_id FROM sections WHERE id = v_current_section_id;
        IF v_section_class_id IS DISTINCT FROM p_class_id THEN
            v_clear_section := TRUE;
        END IF;
    END IF;

    UPDATE students
    SET
        gender = COALESCE(p_gender, gender),
        first_name = COALESCE(NULLIF(TRIM(p_first_name), ''), first_name),
        last_name = NULLIF(TRIM(COALESCE(p_last_name, '')), ''),
        date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
        roll_number = COALESCE(NULLIF(TRIM(p_roll_number), ''), roll_number),
        class_id = COALESCE(p_class_id, class_id),
        section_id = CASE
            WHEN v_clear_section THEN NULL
            ELSE COALESCE(p_section_id, section_id)
        END,
        address_location = p_address_location,
        address_city = p_address_city,
        address_district = p_address_district,
        address_state = p_address_state,
        address_pin = p_address_pin,
        father_name = COALESCE(NULLIF(TRIM(p_father_name), ''), father_name),
        mother_name = CASE WHEN p_mother_name IS NULL THEN mother_name ELSE NULLIF(TRIM(p_mother_name), '') END,
        guardian_email = p_guardian_email,
        guardian_phone = COALESCE(NULLIF(TRIM(p_guardian_phone), ''), guardian_phone),
        emergency_contact_number = p_emergency_contact_number,
        blood_group = p_blood_group,
        residence_type = COALESCE(p_residence_type, residence_type),
        specialisation = p_specialisation,
        is_active = COALESCE(p_is_active, is_active),
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_student(p_id uuid, p_deleted_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_id) THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    IF EXISTS (SELECT 1 FROM examination_results WHERE student_id = p_id) THEN
        RAISE EXCEPTION 'Cannot delete student with examination results';
    END IF;

    IF EXISTS (SELECT 1 FROM student_fees WHERE student_id = p_id) THEN
        RAISE EXCEPTION 'Cannot delete student with fee records';
    END IF;

    -- Hard delete (permanent)
    DELETE FROM students WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_student(p_id uuid, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM students WHERE id = p_id AND is_deleted = TRUE
    ) THEN
        RAISE EXCEPTION 'Student not found or not deleted';
    END IF;

    UPDATE students
    SET
        is_deleted = FALSE,
        deleted_at = NULL,
        deleted_by = NULL,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_student_status(p_id uuid, p_updated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE students
    SET
        is_active = NOT is_active,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = p_id AND is_deleted = FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_create_student(p_gender character varying, p_first_name character varying, p_last_name character varying, p_date_of_birth date, p_roll_number character varying, p_class_id uuid, p_section_id uuid DEFAULT NULL::uuid, p_address_location text DEFAULT NULL::text, p_address_city character varying DEFAULT NULL::character varying, p_address_district character varying DEFAULT NULL::character varying, p_address_state character varying DEFAULT NULL::character varying, p_address_pin character varying DEFAULT NULL::character varying, p_father_name character varying DEFAULT NULL::character varying, p_mother_name character varying DEFAULT NULL::character varying, p_guardian_email character varying DEFAULT NULL::character varying, p_guardian_phone character varying DEFAULT NULL::character varying, p_emergency_contact_number character varying DEFAULT NULL::character varying, p_blood_group character varying DEFAULT NULL::character varying, p_residence_type character varying DEFAULT NULL::character varying, p_specialisation character varying DEFAULT NULL::character varying, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.create_student(
    p_gender,
    p_first_name,
    p_last_name,
    p_date_of_birth,
    p_roll_number,
    p_class_id,
    p_section_id,
    p_address_location,
    p_address_city,
    p_address_district,
    p_address_state,
    p_address_pin,
    p_father_name,
    p_mother_name,
    p_guardian_email,
    p_guardian_phone,
    p_emergency_contact_number,
    p_blood_group,
    p_residence_type,
    p_specialisation,
    p_created_by
  );

  RETURN QUERY SELECT 201, 'Student created successfully', jsonb_build_object('id', v_id);
EXCEPTION
  WHEN OTHERS THEN
    IF LOWER(SQLERRM) LIKE '%roll number already exists%' THEN
      RETURN QUERY SELECT 409, 'Roll number already exists', NULL::jsonb;
      RETURN;
    END IF;
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_students(p_search text DEFAULT NULL::text, p_class_id uuid DEFAULT NULL::uuid, p_section_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    200,
    'Students fetched successfully',
    COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  FROM public.get_students(p_search, p_class_id, p_section_id) x;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_get_student_by_id(p_id uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_student students;
BEGIN
  v_student := public.get_student_by_id(p_id);
  RETURN QUERY SELECT 200, 'Student fetched successfully', to_jsonb(v_student);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_update_student(p_id uuid, p_gender character varying DEFAULT NULL::character varying, p_first_name character varying DEFAULT NULL::character varying, p_last_name character varying DEFAULT NULL::character varying, p_date_of_birth date DEFAULT NULL::date, p_roll_number character varying DEFAULT NULL::character varying, p_class_id uuid DEFAULT NULL::uuid, p_section_id uuid DEFAULT NULL::uuid, p_address_location text DEFAULT NULL::text, p_address_city character varying DEFAULT NULL::character varying, p_address_district character varying DEFAULT NULL::character varying, p_address_state character varying DEFAULT NULL::character varying, p_address_pin character varying DEFAULT NULL::character varying, p_father_name character varying DEFAULT NULL::character varying, p_mother_name character varying DEFAULT NULL::character varying, p_guardian_email character varying DEFAULT NULL::character varying, p_guardian_phone character varying DEFAULT NULL::character varying, p_emergency_contact_number character varying DEFAULT NULL::character varying, p_blood_group character varying DEFAULT NULL::character varying, p_residence_type character varying DEFAULT NULL::character varying, p_specialisation character varying DEFAULT NULL::character varying, p_is_active boolean DEFAULT NULL::boolean, p_updated_by uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.update_student(
    p_id,
    p_gender,
    p_first_name,
    p_last_name,
    p_date_of_birth,
    p_roll_number,
    p_class_id,
    p_section_id,
    p_address_location,
    p_address_city,
    p_address_district,
    p_address_state,
    p_address_pin,
    p_father_name,
    p_mother_name,
    p_guardian_email,
    p_guardian_phone,
    p_emergency_contact_number,
    p_blood_group,
    p_residence_type,
    p_specialisation,
    p_is_active,
    p_updated_by
  );

  RETURN QUERY SELECT 200, 'Student updated successfully', jsonb_build_object('id', p_id);
EXCEPTION
  WHEN OTHERS THEN
    IF LOWER(SQLERRM) LIKE '%roll number already exists%' THEN
      RETURN QUERY SELECT 409, 'Roll number already exists', NULL::jsonb;
      RETURN;
    END IF;
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_delete_student(p_id uuid, p_deleted_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.delete_student(p_id, p_deleted_by);
  RETURN QUERY SELECT 200, 'Student deleted successfully', NULL::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    IF LOWER(SQLERRM) LIKE '%student not found%' THEN
      RETURN QUERY SELECT 404, 'Student not found', NULL::jsonb;
      RETURN;
    END IF;
    IF LOWER(SQLERRM) LIKE '%cannot delete student%' THEN
      RETURN QUERY SELECT 409, SQLERRM, NULL::jsonb;
      RETURN;
    END IF;
    RETURN QUERY SELECT 500, SQLERRM, NULL::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_restore_student(p_id uuid, p_updated_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.restore_student(p_id, p_updated_by);
  RETURN QUERY SELECT 200, 'Student restored successfully', NULL::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atr_toggle_student_status(p_id uuid, p_updated_by uuid)
 RETURNS TABLE(status_code integer, message text, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.toggle_student_status(p_id, p_updated_by);
  RETURN QUERY SELECT 200, 'Student status updated successfully', NULL::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 500, SQLERRM, NULL;
END;
$function$;
