import { query } from '../db/db.js';
import { MESSAGES } from '../constants/messages.js';

const SQL = {
  list: 'SELECT * FROM public.get_subjects($1)',
  create: 'SELECT public.create_subject($1,$2,$3,$4) AS id',
  update: 'SELECT public.update_subject($1,$2,$3,$4,$5,$6)',
  delete: 'SELECT public.delete_subject($1,$2)',
  restore: 'SELECT public.restore_subject($1,$2)',
  toggleStatus: 'SELECT public.toggle_subject_status($1,$2)',
  reorder: 'SELECT public.reorder_subjects($1)',
};

export async function getSubjects(search) {
  const rows = await query(SQL.list, [search ?? null]);
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.subject.fetchedSuccess,
    data: { subjects: rows ?? [] },
  };
}

export async function createSubject(payload, actorUserId) {
  const name = String(payload.name ?? '').trim();
  const code =
    payload.code !== undefined && payload.code !== null && String(payload.code).trim() !== ''
      ? String(payload.code).trim()
      : null;
  const description =
    payload.description !== undefined && payload.description !== null && String(payload.description).trim() !== ''
      ? String(payload.description).trim()
      : null;

  const rows = await query(SQL.create, [name, actorUserId, code, description]);
  const id = rows?.[0]?.id ?? null;
  return {
    statusCode: 201,
    success: true,
    message: MESSAGES.subject.createdSuccess,
    data: { id, name, code, description },
  };
}

export async function updateSubject(subjectId, payload, actorUserId) {
  const name = String(payload.name ?? '').trim();
  const code =
    payload.code !== undefined
      ? payload.code === null || String(payload.code).trim() === ''
        ? null
        : String(payload.code).trim()
      : null;
  const description =
    payload.description !== undefined
      ? payload.description === null || String(payload.description).trim() === ''
        ? null
        : String(payload.description).trim()
      : null;
  const isActive = payload.is_active ?? null;

  await query(SQL.update, [subjectId, name, code, description, isActive, actorUserId]);
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.subject.updatedSuccess,
    data: { id: subjectId, name, code, description, is_active: isActive ?? undefined },
  };
}

export async function deleteSubject(subjectId, actorUserId) {
  await query(SQL.delete, [subjectId, actorUserId]);
  return { statusCode: 200, success: true, message: MESSAGES.subject.deletedSuccess, data: null };
}

export async function restoreSubject(subjectId, actorUserId) {
  await query(SQL.restore, [subjectId, actorUserId]);
  return { statusCode: 200, success: true, message: MESSAGES.subject.restoredSuccess, data: null };
}

export async function toggleSubjectStatus(subjectId, actorUserId) {
  await query(SQL.toggleStatus, [subjectId, actorUserId]);
  return { statusCode: 200, success: true, message: MESSAGES.subject.statusUpdatedSuccess, data: null };
}

export async function reorderSubjects(orderedIds) {
  await query(SQL.reorder, [orderedIds]);
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.subject.reorderedSuccess,
    data: null,
  };
}

