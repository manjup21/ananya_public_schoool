import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';

const SQL = {
  getClasses: 'SELECT * FROM public.atr_get_classes()',
  createClass: 'SELECT * FROM public.atr_create_class($1, $2)',
  updateClass: 'SELECT * FROM public.atr_update_class($1, $2, $3)',
  deleteClass: 'SELECT * FROM public.atr_delete_class($1)',
  createSection: 'SELECT * FROM public.atr_create_section($1, $2, $3)',
  updateSection: 'SELECT * FROM public.atr_update_section($1, $2, $3)',
  deleteSection: 'SELECT * FROM public.atr_delete_section($1)',
};

function normalizeSectionList(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    id: s.id,
    section: s.section ?? s.section_code ?? '',
  }));
}

function normalizeClassesList(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    sections: normalizeSectionList(c.sections),
  }));
}

/**
 * When there are no classes, atr_get_classes returns zero rows.
 */
export async function getClasses() {
  const rows = await callProcedure(SQL.getClasses, []);
  if (!rows.length) {
    return {
      statusCode: 200,
      success: true,
      message: MESSAGES.classSection.fetchedSuccess,
      data: { classes: [] },
    };
  }
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;
  const classes = normalizeClassesList(result.data);
  return { ...result, data: { classes } };
}

export async function createClass(name, createdByUserId) {
  const rows = await callProcedure(SQL.createClass, [String(name).trim(), createdByUserId]);
  return fromDbRow(rows[0]);
}

export async function updateClass(classId, name, updatedByUserId) {
  const rows = await callProcedure(SQL.updateClass, [classId, String(name).trim(), updatedByUserId]);
  return fromDbRow(rows[0]);
}

export async function deleteClass(classId) {
  const rows = await callProcedure(SQL.deleteClass, [classId]);
  return fromDbRow(rows[0]);
}

export async function createSection(classId, sectionCode, createdByUserId) {
  const code = String(sectionCode).trim().toUpperCase();
  const rows = await callProcedure(SQL.createSection, [classId, code, createdByUserId]);
  return fromDbRow(rows[0]);
}

export async function updateSection(sectionId, sectionCode, updatedByUserId) {
  const code = String(sectionCode).trim().toUpperCase();
  const rows = await callProcedure(SQL.updateSection, [sectionId, code, updatedByUserId]);
  return fromDbRow(rows[0]);
}

export async function deleteSection(sectionId) {
  const rows = await callProcedure(SQL.deleteSection, [sectionId]);
  return fromDbRow(rows[0]);
}
