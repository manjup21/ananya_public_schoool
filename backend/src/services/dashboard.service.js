import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { optStr } from '../utils/params.js';

const SQL = {
  admin: 'SELECT * FROM public.atr_get_admin_dashboard($1,$2)',
  lecturer: 'SELECT * FROM public.atr_get_lecturer_dashboard($1,$2)',
};

export async function getAdminDashboard({ from, to }) {
  const rows = await callProcedure(SQL.admin, [optStr(from), optStr(to)]);
  return fromDbRow(rows?.[0]);
}

export async function getLecturerDashboard({ from, to }) {
  const rows = await callProcedure(SQL.lecturer, [optStr(from), optStr(to)]);
  return fromDbRow(rows?.[0]);
}

