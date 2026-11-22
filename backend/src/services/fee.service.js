import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { optStr, optUuid } from '../utils/params.js';

const SQL = {
  assign: 'SELECT * FROM public.atr_assign_student_fee($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  bulkAssign: 'SELECT * FROM public.atr_bulk_assign_student_fee($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
  recordPayment: 'SELECT * FROM public.atr_record_fee_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
  getStudentFee: 'SELECT * FROM public.atr_get_student_fee($1,$2)',
  listStudentFees: 'SELECT * FROM public.atr_list_student_fees($1,$2,$3,$4,$5,$6)',
  paymentHistory: 'SELECT * FROM public.atr_get_fee_payment_history($1,$2,$3)',
  deletePayment: 'SELECT * FROM public.atr_delete_fee_payment($1)',
  deleteFeeItem: 'SELECT * FROM public.atr_delete_student_fee_item($1)',
  dashboardSummary: 'SELECT * FROM public.atr_get_fee_dashboard_summary($1,$2,$3)',
};

function optNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function optInt(v) {
  const n = optNum(v);
  return n === null ? null : Math.trunc(n);
}

export async function assignStudentFee(payload, actorUserId) {
  const rows = await callProcedure(SQL.assign, [
    optUuid(payload.student_id),
    optStr(payload.academic_year),
    optNum(payload.total_fee),
    optNum(payload.discount),
    payload.due_date ?? null,
    optStr(payload.notes),
    optUuid(actorUserId),
    Boolean(payload.add_to_existing),
    optStr(payload.fee_name),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function bulkAssignFee(payload, actorUserId) {
  const rows = await callProcedure(SQL.bulkAssign, [
    optUuid(payload.class_id),
    optStr(payload.academic_year),
    optNum(payload.total_fee),
    optNum(payload.discount),
    payload.due_date ?? null,
    optUuid(payload.section_id),
    optStr(payload.notes),
    optUuid(actorUserId),
    Boolean(payload.add_to_existing),
    optStr(payload.fee_name),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function recordFeePayment(payload, actorUserId) {
  const rows = await callProcedure(SQL.recordPayment, [
    optUuid(payload.student_fee_id),
    optNum(payload.amount),
    payload.payment_date ?? null,
    optStr(payload.payment_method),
    optStr(payload.reference_number),
    optStr(payload.receipt_number),
    optStr(payload.gateway_order_id),
    optStr(payload.gateway_payment_id),
    optStr(payload.gateway_status),
    optStr(payload.notes),
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function getStudentFee(studentId, academicYear) {
  const rows = await callProcedure(SQL.getStudentFee, [
    optUuid(studentId),
    optStr(academicYear),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function listStudentFees({ academicYear, search, classId, sectionId, page, limit }) {
  const rows = await callProcedure(SQL.listStudentFees, [
    optStr(academicYear),
    optStr(search),
    optUuid(classId),
    optUuid(sectionId),
    optInt(page) ?? 1,
    optInt(limit) ?? 25,
  ]);
  return fromDbRow(rows?.[0]);
}

export async function getPaymentHistory(studentFeeId, { page, limit }) {
  const rows = await callProcedure(SQL.paymentHistory, [
    optUuid(studentFeeId),
    optInt(page) ?? 1,
    optInt(limit) ?? 20,
  ]);
  return fromDbRow(rows?.[0]);
}

export async function deletePayment(paymentId) {
  const rows = await callProcedure(SQL.deletePayment, [optUuid(paymentId)]);
  return fromDbRow(rows?.[0]);
}

export async function deleteFeeItem(itemId) {
  const rows = await callProcedure(SQL.deleteFeeItem, [optUuid(itemId)]);
  return fromDbRow(rows?.[0]);
}

export async function getFeeDashboardSummary({ academicYear, classId, sectionId }) {
  const rows = await callProcedure(SQL.dashboardSummary, [
    optStr(academicYear),
    optUuid(classId),
    optUuid(sectionId),
  ]);
  return fromDbRow(rows?.[0]);
}
