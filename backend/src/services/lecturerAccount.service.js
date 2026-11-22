import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';

const SQL = {
  getByUserId: 'SELECT * FROM public.atr_get_lecturer_by_user_id($1::uuid)',
};

export async function getLecturerProfileByUserId(userId) {
  const rows = await callProcedure(SQL.getByUserId, [userId]);
  return fromDbRow(rows?.[0]);
}
