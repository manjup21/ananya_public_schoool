import { query } from '../db/db.js';
import { MESSAGES } from '../constants/messages.js';

const SQL = {
  list: 'SELECT * FROM public.get_exam_types($1)',
  create: 'SELECT public.create_exam_type($1,$2) AS id',
  update: 'SELECT public.update_exam_type($1,$2,$3)',
  delete: 'SELECT public.delete_exam_type($1)',
  reorder: 'SELECT public.reorder_exam_types($1)',
};

export async function getExamTypes(search) {
  const rows = await query(SQL.list, [search ?? null]);
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.examType.fetchedSuccess,
    data: { exam_types: rows ?? [] },
  };
}

export async function createExamType(payload, actorUserId) {
  const name = String(payload.name ?? '').trim();
  const rows = await query(SQL.create, [name, actorUserId]);
  const id = rows?.[0]?.id ?? null;
  return {
    statusCode: 201,
    success: true,
    message: MESSAGES.examType.createdSuccess,
    data: { id, name },
  };
}

export async function updateExamType(examTypeId, payload, actorUserId) {
  const name = String(payload.name ?? '').trim();
  await query(SQL.update, [examTypeId, name, actorUserId]);
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.examType.updatedSuccess,
    data: { id: examTypeId, name },
  };
}

export async function deleteExamType(examTypeId) {
  await query(SQL.delete, [examTypeId]);
  return { statusCode: 200, success: true, message: MESSAGES.examType.deletedSuccess, data: null };
}

export async function reorderExamTypes(orderedIds) {
  await query(SQL.reorder, [orderedIds]);
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.examType.reorderedSuccess,
    data: null,
  };
}
