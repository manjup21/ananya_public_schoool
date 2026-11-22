import { callProcedure, pool } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { renameStudentPhotoForRollChange } from './studentPhoto.service.js';
import { optStr, optUuid } from '../utils/params.js';

const SQL = {
  list: 'SELECT * FROM public.atr_get_students($1,$2,$3)',
  create: 'SELECT * FROM public.atr_create_student($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)',
  getById: 'SELECT * FROM public.atr_get_student_by_id($1)',
  update: 'SELECT * FROM public.atr_update_student($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)',
  delete: 'SELECT * FROM public.atr_delete_student($1,$2)',
  restore: 'SELECT * FROM public.atr_restore_student($1,$2)',
  toggleStatus: 'SELECT * FROM public.atr_toggle_student_status($1,$2)',
};

async function classHasSections(classId) {
  if (!classId) return false;
  const result = await pool.query(
    'SELECT COUNT(*)::int AS n FROM public.sections WHERE class_id = $1::uuid',
    [classId]
  );
  const rowList = Array.isArray(result?.rows) ? result.rows : [];
  return Number(rowList[0]?.n ?? 0) > 0;
}

async function validateSectionForClass(classId, sectionId) {
  if (!classId) return null;
  const hasSections = await classHasSections(classId);
  if (hasSections && !sectionId) {
    return {
      statusCode: 400,
      success: false,
      message: 'Section is required for this class',
      data: null,
    };
  }
  return null;
}

export async function getStudents({ search, classId, sectionId }) {
  const rows = await callProcedure(SQL.list, [optStr(search), optUuid(classId), optUuid(sectionId)]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;
  return { ...result, data: { students: Array.isArray(result.data) ? result.data : [] } };
}

export async function createStudent(payload, actorUserId) {
  const classId = optUuid(payload.class_id);
  const sectionId = optUuid(payload.section_id);
  const sectionError = await validateSectionForClass(classId, sectionId);
  if (sectionError) return sectionError;

  const rows = await callProcedure(SQL.create, [
    optStr(payload.gender),
    optStr(payload.first_name),
    optStr(payload.last_name),
    optStr(payload.date_of_birth),
    optStr(payload.roll_number),
    optUuid(payload.class_id),
    optUuid(payload.section_id),
    optStr(payload.address_location),
    optStr(payload.address_city),
    optStr(payload.address_district),
    optStr(payload.address_state),
    optStr(payload.address_pin),
    optStr(payload.father_name),
    optStr(payload.mother_name),
    optStr(payload.guardian_email),
    optStr(payload.guardian_phone),
    optStr(payload.emergency_contact_number),
    optStr(payload.blood_group),
    optStr(payload.residence_type),
    optStr(payload.specialisation),
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function getStudentById(studentId) {
  const rows = await callProcedure(SQL.getById, [optUuid(studentId)]);
  return fromDbRow(rows?.[0]);
}

export async function updateStudent(studentId, payload, actorUserId) {
  const classId = optUuid(payload.class_id);
  const sectionId = optUuid(payload.section_id);
  let effectiveClassId = classId;
  const existing = await getStudentById(studentId);
  if (!existing.success) return existing;

  if (!effectiveClassId && existing.data?.class_id) {
    effectiveClassId = String(existing.data.class_id);
  }
  const sectionError = await validateSectionForClass(effectiveClassId, sectionId);
  if (sectionError) return sectionError;

  const oldRoll = existing.data?.roll_number ?? null;
  const oldPhotoPath = existing.data?.photo_path ?? null;
  const newRoll = optStr(payload.roll_number) ?? oldRoll;

  const rows = await callProcedure(SQL.update, [
    optUuid(studentId),
    optStr(payload.gender),
    optStr(payload.first_name),
    optStr(payload.last_name),
    optStr(payload.date_of_birth),
    optStr(payload.roll_number),
    optUuid(payload.class_id),
    optUuid(payload.section_id),
    optStr(payload.address_location),
    optStr(payload.address_city),
    optStr(payload.address_district),
    optStr(payload.address_state),
    optStr(payload.address_pin),
    optStr(payload.father_name),
    optStr(payload.mother_name),
    optStr(payload.guardian_email),
    optStr(payload.guardian_phone),
    optStr(payload.emergency_contact_number),
    optStr(payload.blood_group),
    optStr(payload.residence_type),
    optStr(payload.specialisation),
    payload.is_active ?? null,
    optUuid(actorUserId),
  ]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;

  if (oldPhotoPath && oldRoll && newRoll && String(oldRoll) !== String(newRoll)) {
    try {
      const updatedPath = await renameStudentPhotoForRollChange(
        studentId,
        oldRoll,
        newRoll,
        oldPhotoPath
      );
      if (result.data && typeof result.data === 'object') {
        result.data = { ...result.data, photo_path: updatedPath };
      }
    } catch (err) {
      console.error('renameStudentPhotoForRollChange', err);
    }
  }

  return result;
}

export async function deleteStudent(studentId, actorUserId) {
  const rows = await callProcedure(SQL.delete, [optUuid(studentId), optUuid(actorUserId)]);
  return fromDbRow(rows?.[0]);
}

export async function restoreStudent(studentId, actorUserId) {
  const rows = await callProcedure(SQL.restore, [optUuid(studentId), optUuid(actorUserId)]);
  return fromDbRow(rows?.[0]);
}

export async function toggleStudentStatus(studentId, actorUserId) {
  const rows = await callProcedure(SQL.toggleStatus, [optUuid(studentId), optUuid(actorUserId)]);
  return fromDbRow(rows?.[0]);
}
