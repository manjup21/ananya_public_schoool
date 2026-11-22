import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import { callProcedure, query } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { env } from '../utils/env.js';
import { MESSAGES } from '../constants/messages.js';
import { optStr, optUuid, optInt } from '../utils/params.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_PATH = path.resolve(__dirname, '../workers/notificationWorker.js');

/** @param {{ batches: { logId: string, recipientRows: object[] }[], channel: string, templateName?: string }} job */
function spawnWorker({ batches, channel, templateName }) {
  const logIds = batches.map((b) => b.logId).join(', ');
  const worker = new Worker(WORKER_PATH, { workerData: { batches, channel, templateName } });
  worker.on('error', (err) => {
    console.error('[notification.service] Worker error for log(s)', logIds, err.message);
  });
  worker.on('exit', (code) => {
    if (code !== 0) console.warn('[notification.service] Worker exited with code', code, 'for log(s)', logIds);
  });
}

const SQL = {
  absenceSummary: 'SELECT * FROM public.atr_get_absence_summary_by_date($1::date)',
  sectionAbsentStudents:
    'SELECT * FROM public.atr_get_section_absent_students($1::uuid, $2::uuid, $3::date)',
  examCandidates: 'SELECT * FROM public.atr_get_exam_notification_candidates($1::uuid)',
  insertLog:
    'SELECT * FROM public.atr_insert_notification_log($1::varchar, $2::varchar, $3::date, $4::uuid, $5::uuid, $6::uuid, $7::int, $8::varchar, $9::text, $10::uuid)',
  lastLog:
    'SELECT * FROM public.atr_get_last_notification_log($1::varchar, $2::uuid, $3::uuid, $4::date, $5::uuid)',
  listLogs: 'SELECT * FROM public.atr_list_notification_logs($1::varchar, $2::int, $3::int)',
  getExamById: 'SELECT * FROM public.atr_get_examination_by_id($1::uuid)',
  insertRecipients: 'SELECT * FROM public.atr_insert_notification_recipients($1::uuid, $2::jsonb)',
  recipientStatuses: 'SELECT * FROM public.atr_get_recipient_statuses($1::uuid)',
  notifiedSlotsBySection:
    'SELECT * FROM public.atr_get_notified_slots_by_section_date($1::uuid, $2::uuid, $3::date)',
  feeDueSummary: 'SELECT * FROM public.atr_get_fee_due_notification_summary($1::varchar)',
  feeDueStudents:
    'SELECT * FROM public.atr_get_fee_due_notification_students($1::uuid, $2::uuid, $3::varchar)',
};

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function fmtDateLong(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return fmtDate(iso);
  }
}

function normalizeSlots(slots) {
  return (slots || []).map((s) => String(s).trim()).filter(Boolean);
}

function slotsFullyNotified(currentSlots, notifiedUnion) {
  const current = normalizeSlots(currentSlots);
  const notified = new Set(normalizeSlots(notifiedUnion));
  if (current.length === 0) return true;
  return current.every((s) => notified.has(s));
}

function hasPartialNotification(currentSlots, notifiedUnion) {
  const current = normalizeSlots(currentSlots);
  const notified = new Set(normalizeSlots(notifiedUnion));
  const notifiedSome = current.some((s) => notified.has(s));
  const notifiedAll = current.every((s) => notified.has(s));
  return notifiedSome && !notifiedAll;
}

function deriveAttendanceNotificationFields(student, notifiedUnion, rStatus, logProcessing) {
  const current = normalizeSlots(student.absent_slots);
  const fullyNotified = slotsFullyNotified(current, notifiedUnion);
  const partial = hasPartialNotification(current, notifiedUnion);

  if (logProcessing && rStatus?.status === 'pending') {
    return {
      notification_status: 'processing',
      notification_sent: false,
      notification_processing: true,
      notification_failed: false,
    };
  }
  if (rStatus?.status === 'failed' && !fullyNotified) {
    return {
      notification_status: 'failed',
      notification_sent: false,
      notification_processing: false,
      notification_failed: true,
    };
  }
  if (fullyNotified) {
    return {
      notification_status: 'sent',
      notification_sent: true,
      notification_processing: false,
      notification_failed: false,
    };
  }
  if (partial) {
    return {
      notification_status: 'partial',
      notification_sent: false,
      notification_processing: false,
      notification_failed: false,
    };
  }
  if (rStatus?.status === 'processing' || (logProcessing && !rStatus)) {
    return {
      notification_status: 'processing',
      notification_sent: false,
      notification_processing: true,
      notification_failed: false,
    };
  }
  return {
    notification_status: 'pending',
    notification_sent: false,
    notification_processing: false,
    notification_failed: false,
  };
}

async function getNotifiedSlotsMap(classId, sectionId, dateStr) {
  const rows = await callProcedure(SQL.notifiedSlotsBySection, [classId, sectionId, dateStr]);
  const result = fromDbRow(rows?.[0]);
  return result.success && result.data ? result.data : {};
}

async function isSectionFullyNotified(classId, sectionId, dateStr) {
  const rows = await callProcedure(SQL.sectionAbsentStudents, [classId, sectionId, dateStr]);
  const result = fromDbRow(rows?.[0]);
  const students = result.success && Array.isArray(result.data) ? result.data : [];
  if (students.length === 0) return true;

  const slotsMap = await getNotifiedSlotsMap(classId, sectionId, dateStr);
  return students.every((s) =>
    slotsFullyNotified(s.absent_slots, slotsMap[s.student_id] || [])
  );
}

function toAttendanceRecipients(students, dateStr) {
  return students.map((s) => ({
    student_id: s.student_id,
    mobile: s.guardian_phone,
    absent_slots: s.absent_slots,
    variables: {
      guardian_name: s.father_name || s.guardian_name,
      student_name: s.student_name,
      date: fmtDate(dateStr),
      slots: (s.absent_slots || []).length > 0 ? s.absent_slots.join(', ') : '',
      school_name: env.schoolName,
    },
  }));
}

/** Log preview text, rendered for the first recipient. */
function buildAttendancePreview(ch, recipient, dateStr) {
  const v = recipient.variables;
  if (ch !== 'whatsapp') {
    const slotPart = v.slots ? ` (${v.slots})` : '';
    return `Your child ${v.student_name} was absent on ${v.date}${slotPart}. For details contact school. -${env.schoolName}`;
  }
  const slotLines = (recipient.absent_slots || []).length > 0
    ? recipient.absent_slots.map((s) => `• ${s}`).join('\n')
    : '• Full day';
  return [
    `*Attendance Alert* — ${env.schoolName}`,
    '',
    'Dear Parent,',
    '',
    `This is to inform you that your child *${v.student_name}* was marked absent on *${fmtDateLong(dateStr)}* for the following periods:`,
    slotLines,
    '',
    'If you believe this is an error, please contact the school office.',
    '',
    'Thank you,',
    env.schoolName,
  ].join('\n');
}

async function insertRecipientsAndGetRows(logId, studentsWithVariables) {
  const recipientPayload = studentsWithVariables.map((s) => ({
    student_id: s.student_id,
    guardian_phone: s.mobile || null,
    notified_slots: normalizeSlots(s.absent_slots),
  }));
  await callProcedure(SQL.insertRecipients, [logId, JSON.stringify(recipientPayload)]);

  const rows = await query(
    'SELECT id, student_id, guardian_phone FROM notification_recipients WHERE log_id = $1 ORDER BY created_at',
    [logId]
  );

  const rowMap = {};
  for (const r of rows) {
    rowMap[r.student_id] = r.id;
  }

  return studentsWithVariables.map((s) => ({
    recipient_id: rowMap[s.student_id],
    mobile: s.mobile,
    variables: s.variables,
  }));
}

async function getRecipientStatusMap(logId) {
  if (!logId) return {};
  const rows = await callProcedure(SQL.recipientStatuses, [logId]);
  const result = fromDbRow(rows?.[0]);
  return result.success && result.data ? result.data : {};
}

// ─── Attendance ──────────────────────────────────────────────────────

export async function getAttendanceSummary(date) {
  const dateStr = optStr(date);
  if (!dateStr) {
    return { statusCode: 400, success: false, message: 'date is required', data: null };
  }

  const rows = await callProcedure(SQL.absenceSummary, [dateStr]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;

  const sections = Array.isArray(result.data) ? result.data : [];

  const enriched = await Promise.all(
    sections.map(async (sec) => {
      const logRows = await callProcedure(SQL.lastLog, [
        'attendance',
        sec.class_id,
        sec.section_id || null,
        dateStr,
        null,
      ]);
      const logResult = fromDbRow(logRows?.[0]);
      const lastLog = logResult.success ? logResult.data : null;
      const logStatus = lastLog?.status || null;
      const fullyNotified = await isSectionFullyNotified(
        sec.class_id,
        sec.section_id || null,
        dateStr
      );
      return {
        ...sec,
        notification_sent: fullyNotified && logStatus !== 'processing',
        notification_processing: logStatus === 'processing',
        notification_partial: !fullyNotified && !!lastLog && logStatus !== 'processing',
        notification_status: logStatus,
      };
    })
  );

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.notification.summaryFetched,
    data: { sections: enriched, school_name: env.schoolName },
  };
}

export async function getAttendanceDetail({ classId, sectionId, date }) {
  const classUuid = optUuid(classId);
  const sectionUuid = optUuid(sectionId);
  const dateStr = optStr(date);

  if (!classUuid || !dateStr) {
    return { statusCode: 400, success: false, message: 'classId and date are required', data: null };
  }

  const rows = await callProcedure(SQL.sectionAbsentStudents, [classUuid, sectionUuid, dateStr]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;

  const students = Array.isArray(result.data) ? result.data : [];

  const [logRows, nameResult] = await Promise.all([
    callProcedure(SQL.lastLog, ['attendance', classUuid, sectionUuid, dateStr, null]),
    getClassSectionNames(classUuid, sectionUuid),
  ]);
  const logResult = fromDbRow(logRows?.[0]);
  const lastLog = logResult.success ? logResult.data : null;

  const logStatus = lastLog?.status || null;
  const logId = lastLog?.id || null;

  const [recipientMap, notifiedSlotsMap] = await Promise.all([
    getRecipientStatusMap(logId),
    getNotifiedSlotsMap(classUuid, sectionUuid, dateStr),
  ]);

  const allNotificationsSent = students.every((s) =>
    slotsFullyNotified(s.absent_slots, notifiedSlotsMap[s.student_id] || [])
  );

  const meta = {
    class_name: nameResult.class_name,
    section_code: nameResult.section_code,
    school_name: env.schoolName,
    last_sent_at: lastLog?.created_at || null,
    last_sent_channel: lastLog?.channel || null,
    last_sent_by: lastLog?.created_by_name || null,
    last_sent_status: logStatus,
    last_log_id: logId,
    sent_count: lastLog?.sent_count || 0,
    failed_count: lastLog?.failed_count || 0,
    all_notifications_sent: allNotificationsSent,
  };

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.notification.detailFetched,
    data: {
      students: students.map((s) => {
        const rStatus = recipientMap[s.student_id];
        const notifiedUnion = notifiedSlotsMap[s.student_id] || [];
        const fields = deriveAttendanceNotificationFields(
          s,
          notifiedUnion,
          rStatus,
          logStatus === 'processing'
        );
        return {
          ...s,
          ...fields,
          notification_error: rStatus?.error_reason || null,
        };
      }),
      meta,
    },
  };
}

export async function sendAttendanceNotification({ classId, sectionId, date, channel, actorUserId }) {
  const classUuid = optUuid(classId);
  const sectionUuid = optUuid(sectionId);
  const dateStr = optStr(date);
  const ch = optStr(channel) || 'sms';

  if (!classUuid || !dateStr) {
    return { statusCode: 400, success: false, message: 'classId and date are required', data: null };
  }
  if (!['sms', 'whatsapp'].includes(ch)) {
    return { statusCode: 400, success: false, message: 'channel must be sms or whatsapp', data: null };
  }

  const rows = await callProcedure(SQL.sectionAbsentStudents, [classUuid, sectionUuid, dateStr]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;

  const students = Array.isArray(result.data) ? result.data : [];
  if (students.length === 0) {
    return { statusCode: 200, success: true, message: MESSAGES.notification.noAbsentStudents, data: { sent: 0, failed: 0 } };
  }

  const notifiedSlotsMap = await getNotifiedSlotsMap(classUuid, sectionUuid, dateStr);
  const unnotified = students.filter(
    (s) => !slotsFullyNotified(s.absent_slots, notifiedSlotsMap[s.student_id] || [])
  );
  // Everyone already notified = the UI's "Resend" button, so send to all again.
  const studentsToNotify = unnotified.length > 0 ? unnotified : students;

  const studentsWithVariables = toAttendanceRecipients(studentsToNotify, dateStr);
  const templateName = ch === 'whatsapp' ? env.msg91.whatsappAttendanceTemplate : undefined;
  const previewMsg = buildAttendancePreview(ch, studentsWithVariables[0], dateStr);

  const logRows = await callProcedure(SQL.insertLog, [
    'attendance',
    ch,
    dateStr,
    null,
    classUuid,
    sectionUuid,
    studentsWithVariables.length,
    'processing',
    previewMsg,
    optUuid(actorUserId),
  ]);
  const logResult = fromDbRow(logRows?.[0]);
  const logId = logResult.data?.id;

  if (!logId) {
    return { statusCode: 500, success: false, message: MESSAGES.common.failedToCreateLog, data: null };
  }

  const recipientRows = await insertRecipientsAndGetRows(logId, studentsWithVariables);
  spawnWorker({ batches: [{ logId, recipientRows }], channel: ch, templateName });

  return {
    statusCode: 202,
    success: true,
    message: `Sending ${studentsWithVariables.length} notification${studentsWithVariables.length !== 1 ? 's' : ''} in the background`,
    data: { queued: studentsWithVariables.length, logId },
  };
}

// ─── Bulk Attendance Send ─────────────────────────────────────────────

export async function sendBulkAttendanceNotifications({ date, channel, actorUserId }) {
  const dateStr = optStr(date);
  const ch = optStr(channel) || 'sms';

  if (!dateStr) {
    return { statusCode: 400, success: false, message: 'date is required', data: null };
  }
  if (!['sms', 'whatsapp'].includes(ch)) {
    return { statusCode: 400, success: false, message: 'channel must be sms or whatsapp', data: null };
  }

  const summaryResult = await getAttendanceSummary(dateStr);
  if (!summaryResult.success) return summaryResult;

  const summaryData = summaryResult.data || {};
  const sections = Array.isArray(summaryData.sections) ? summaryData.sections : (Array.isArray(summaryData) ? summaryData : []);
  const unsent = sections.filter((s) => !s.notification_sent && !s.notification_processing && s.absent_count > 0);

  if (unsent.length === 0) {
    return { statusCode: 200, success: true, message: MESSAGES.notification.allSectionsNotified, data: { queued: 0, sections: 0, skipped: sections.length } };
  }

  const templateName = ch === 'whatsapp' ? env.msg91.whatsappAttendanceTemplate : undefined;
  const batches = [];
  let totalQueued = 0;

  for (const sec of unsent) {
    const rows = await callProcedure(SQL.sectionAbsentStudents, [sec.class_id, sec.section_id || null, dateStr]);
    const result = fromDbRow(rows?.[0]);
    if (!result.success) continue;

    const students = Array.isArray(result.data) ? result.data : [];
    if (students.length === 0) continue;

    const notifiedSlotsMap = await getNotifiedSlotsMap(sec.class_id, sec.section_id || null, dateStr);
    const studentsToNotify = students.filter(
      (s) => !slotsFullyNotified(s.absent_slots, notifiedSlotsMap[s.student_id] || [])
    );
    if (studentsToNotify.length === 0) continue;

    const studentsWithVariables = toAttendanceRecipients(studentsToNotify, dateStr);
    const previewMsg = buildAttendancePreview(ch, studentsWithVariables[0], dateStr);

    const logRows = await callProcedure(SQL.insertLog, [
      'attendance',
      ch,
      dateStr,
      null,
      sec.class_id,
      sec.section_id || null,
      studentsWithVariables.length,
      'processing',
      previewMsg,
      optUuid(actorUserId),
    ]);
    const logResult = fromDbRow(logRows?.[0]);
    const logId = logResult.data?.id;
    if (!logId) continue;

    const recipientRows = await insertRecipientsAndGetRows(logId, studentsWithVariables);

    batches.push({ logId, recipientRows });
    totalQueued += recipientRows.length;
  }

  if (batches.length === 0) {
    return { statusCode: 200, success: true, message: MESSAGES.notification.noStudentsToNotify, data: { queued: 0, sections: 0, skipped: sections.length } };
  }

  spawnWorker({ batches, channel: ch, templateName });

  return {
    statusCode: 202,
    success: true,
    message: `Queued ${totalQueued} notifications across ${batches.length} section${batches.length !== 1 ? 's' : ''}`,
    data: {
      queued: totalQueued,
      sections: batches.length,
      skipped: sections.length - unsent.length,
    },
  };
}

// ─── Examinations ────────────────────────────────────────────────────

export async function getExamNotificationList() {
  const examRows = await callProcedure(
    `SELECT * FROM public.atr_get_examinations($1::text, $2::uuid, $3::uuid, $4::varchar, $5::uuid)`,
    [null, null, null, 'completed', null]
  );
  const examResult = fromDbRow(examRows?.[0]);
  if (!examResult.success) return examResult;

  const exams = Array.isArray(examResult.data) ? examResult.data : [];

  const enriched = await Promise.all(
    exams.map(async (exam) => {
      const [candRows, logRows, nameResult] = await Promise.all([
        callProcedure(SQL.examCandidates, [exam.id]),
        callProcedure(SQL.lastLog, [
          'exam_result',
          exam.class_id,
          exam.section_id || null,
          null,
          exam.id,
        ]),
        getClassSectionNames(exam.class_id, exam.section_id),
      ]);

      const candResult = fromDbRow(candRows?.[0]);
      const candidates = candResult.success && Array.isArray(candResult.data) ? candResult.data : [];

      const logResult = fromDbRow(logRows?.[0]);
      const lastLog = logResult.success ? logResult.data : null;

      const eLogStatus = lastLog?.status || null;
      return {
        id: exam.id,
        test_name: exam.test_name,
        exam_type_name: exam.exam_type_name || null,
        class_id: exam.class_id,
        class_name: nameResult.class_name,
        section_id: exam.section_id || null,
        section_label: nameResult.section_code || null,
        exam_date: exam.exam_date,
        result_count: candidates.length,
        notification_sent: !!lastLog && eLogStatus !== 'processing',
        notification_processing: eLogStatus === 'processing',
        notification_partial: eLogStatus === 'partial',
        notification_status: eLogStatus,
      };
    })
  );

  return { statusCode: 200, success: true, message: MESSAGES.notification.examListFetched, data: enriched };
}

export async function getExamNotificationDetail(examinationId) {
  const examUuid = optUuid(examinationId);
  if (!examUuid) {
    return { statusCode: 400, success: false, message: 'examinationId is required', data: null };
  }

  const examRows = await callProcedure(SQL.getExamById, [examUuid]);
  const examResult = fromDbRow(examRows?.[0]);
  if (!examResult.success) return examResult;

  const exam = examResult.data;
  if (!exam || typeof exam !== 'object') {
    return { statusCode: 404, success: false, message: MESSAGES.examination.notFound, data: null };
  }

  const [candRows, logRows, nameResult] = await Promise.all([
    callProcedure(SQL.examCandidates, [examUuid]),
    callProcedure(SQL.lastLog, [
      'exam_result',
      exam.class_id,
      exam.section_id || null,
      null,
      examUuid,
    ]),
    getClassSectionNames(exam.class_id, exam.section_id),
  ]);

  const candResult = fromDbRow(candRows?.[0]);
  if (!candResult.success) return candResult;

  const students = Array.isArray(candResult.data) ? candResult.data : [];

  const logResult = fromDbRow(logRows?.[0]);
  const lastLog = logResult.success ? logResult.data : null;

  const detailLogStatus = lastLog?.status || null;
  const logId = lastLog?.id || null;

  const recipientMap = await getRecipientStatusMap(logId);

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.notification.examDetailFetched,
    data: {
      students: students.map((s) => {
        const rStatus = recipientMap[s.student_id];
        return {
          ...s,
          notification_status: rStatus?.status || (logId && detailLogStatus !== 'processing' ? 'sent' : detailLogStatus === 'processing' ? 'processing' : 'pending'),
          notification_error: rStatus?.error_reason || null,
          notification_sent: rStatus ? rStatus.status === 'sent' : (!!lastLog && detailLogStatus !== 'processing'),
          notification_processing: rStatus ? false : detailLogStatus === 'processing',
          notification_failed: rStatus?.status === 'failed' || false,
        };
      }),
      exam: {
        id: exam.id,
        test_name: exam.test_name,
        exam_type_name: exam.exam_type_name || null,
        class_id: exam.class_id,
        class_name: nameResult.class_name,
        section_id: exam.section_id || null,
        section_label: nameResult.section_code || null,
        exam_date: exam.exam_date,
        max_marks: exam.max_marks,
        school_name: env.schoolName,
        last_sent_at: lastLog?.created_at || null,
        last_sent_channel: lastLog?.channel || null,
        last_sent_by: lastLog?.created_by_name || null,
        last_sent_status: detailLogStatus,
        last_log_id: logId,
        sent_count: lastLog?.sent_count || 0,
        failed_count: lastLog?.failed_count || 0,
      },
    },
  };
}

export async function sendExamNotification({ examId, channel, actorUserId }) {
  const examUuid = optUuid(examId);
  const ch = optStr(channel) || 'sms';

  if (!examUuid) {
    return { statusCode: 400, success: false, message: 'examId is required', data: null };
  }
  if (!['sms', 'whatsapp'].includes(ch)) {
    return { statusCode: 400, success: false, message: 'channel must be sms or whatsapp', data: null };
  }

  const examRows = await callProcedure(SQL.getExamById, [examUuid]);
  const examResult = fromDbRow(examRows?.[0]);
  if (!examResult.success) return examResult;
  const exam = examResult.data;
  if (!exam) {
    return { statusCode: 404, success: false, message: MESSAGES.examination.notFound, data: null };
  }

  const candRows = await callProcedure(SQL.examCandidates, [examUuid]);
  const candResult = fromDbRow(candRows?.[0]);
  if (!candResult.success) return candResult;

  const students = Array.isArray(candResult.data) ? candResult.data : [];
  if (students.length === 0) {
    return { statusCode: 200, success: true, message: MESSAGES.notification.noPublishedResults, data: { sent: 0, failed: 0 } };
  }

  const studentsWithVariables = students.map((s) => {
    const pct = exam.max_marks > 0 ? ((s.total_marks / exam.max_marks) * 100).toFixed(1) : '—';
    return {
      student_id: s.student_id,
      mobile: s.guardian_phone,
      variables: {
        guardian_name: s.father_name || s.guardian_name,
        student_name: s.student_name,
        exam_name: exam.test_name,
        exam_date: fmtDate(exam.exam_date),
        total_marks: String(s.total_marks ?? '—'),
        max_marks: String(exam.max_marks ?? '—'),
        percentage: pct,
        school_name: env.schoolName,
        subject_marks: s.subject_marks || [],
      },
    };
  });

  const templateName = ch === 'whatsapp' ? env.msg91.whatsappExamTemplate : undefined;

  const v = studentsWithVariables[0].variables;
  let previewMsg;
  if (ch === 'whatsapp') {
    const dateLine = exam.exam_date ? `\nDate: *${fmtDateLong(exam.exam_date)}*` : '';
    const pctLine = v.percentage !== '—' ? `\nPercentage: *${v.percentage}%*` : '';
    const subjectLines = (v.subject_marks || []).map((sm) => {
      if (sm.is_absent) return `• ${sm.subject_name}: _Absent_`;
      if (sm.is_part_b || (sm.grade_text != null && String(sm.grade_text).trim() !== '')) {
        return `• ${sm.subject_name}: *${String(sm.grade_text).trim() || '—'}*`;
      }
      return `• ${sm.subject_name}: *${sm.mark ?? '—'}*/${sm.max_marks ?? '—'}`;
    });
    const subjectBlock = subjectLines.length > 0
      ? `\n\n*Subject-wise Marks:*\n${subjectLines.join('\n')}`
      : '';
    previewMsg = [
      `*Exam Result* — ${env.schoolName}`,
      '',
      'Dear Parent,',
      '',
      `The results for *${v.exam_name}* are now available.`,
      '',
      `Student: *${v.student_name}*${dateLine}`,
      subjectBlock,
      '',
      `*Total: ${v.total_marks} / ${v.max_marks}*${pctLine}`,
      '',
      'For any queries, please contact the school office.',
      '',
      'Thank you,',
      env.schoolName,
    ].join('\n');
  } else {
    const datePart = exam.exam_date ? ` on ${fmtDate(exam.exam_date)}` : '';
    previewMsg = `${v.student_name} scored ${v.total_marks}/${v.max_marks} (${v.percentage}%) in ${v.exam_name}${datePart}. For details contact school. -${env.schoolName}`;
  }

  const logRows = await callProcedure(SQL.insertLog, [
    'exam_result',
    ch,
    exam.exam_date || null,
    examUuid,
    exam.class_id,
    exam.section_id || null,
    studentsWithVariables.length,
    'processing',
    previewMsg,
    optUuid(actorUserId),
  ]);
  const logResult = fromDbRow(logRows?.[0]);
  const logId = logResult.data?.id;

  if (!logId) {
    return { statusCode: 500, success: false, message: MESSAGES.common.failedToCreateLog, data: null };
  }

  const recipientRows = await insertRecipientsAndGetRows(logId, studentsWithVariables);
  spawnWorker({ batches: [{ logId, recipientRows }], channel: ch, templateName });

  return {
    statusCode: 202,
    success: true,
    message: `Sending ${studentsWithVariables.length} notification${studentsWithVariables.length !== 1 ? 's' : ''} in the background`,
    data: { queued: studentsWithVariables.length, logId },
  };
}

const FEE_DUE_DATE_FALLBACK = 'the earliest';

function formatFeeDueDateForMessage(dueDateIso) {
  if (!dueDateIso) return FEE_DUE_DATE_FALLBACK;
  return fmtDateLong(dueDateIso) || FEE_DUE_DATE_FALLBACK;
}

function formatPendingAmount(balance) {
  if (balance == null) return '0';
  return Number(balance).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function buildFeeDuePreviewMessage({ studentName, balance, dueDateIso }) {
  const student = studentName || 'your child';
  const amount = formatPendingAmount(balance);
  const dueText = formatFeeDueDateForMessage(dueDateIso);
  const office = String(env.schoolPhone || '').trim() || 'the school office';
  const school = env.schoolName || 'Ananya Public School';
  return [
    `*${school}*`,
    '*Fees Alert*',
    '',
    'Dear Parent,',
    '',
    `This is a reminder that the fees for your child *${student}* is due on *${dueText}*.`,
    '',
    `Pending Fees: *₹${amount}*`,
    '',
    `If you have any queries, please contact the office *${office}*`,
    '',
    'Thank you',
  ].join('\n');
}

// ─── Fee Due ─────────────────────────────────────────────────────────

export async function getFeeDueNotificationSummary(academicYear) {
  const year = optStr(academicYear);
  if (!year) {
    return { statusCode: 400, success: false, message: 'academic_year is required', data: null };
  }

  const rows = await callProcedure(SQL.feeDueSummary, [year]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;

  const sections = Array.isArray(result.data) ? result.data : [];

  const enriched = await Promise.all(
    sections.map(async (row) => {
      const logRows = await callProcedure(SQL.lastLog, [
        'fee_due',
        row.class_id,
        row.section_id || null,
        null,
        null,
      ]);
      const logResult = fromDbRow(logRows?.[0]);
      const lastLog = logResult.success ? logResult.data : null;
      const status = lastLog?.status || null;

      return {
        class_id: row.class_id,
        class_name: row.class_name,
        section_id: row.section_id || null,
        section_label: row.section_label || null,
        academic_year: row.academic_year || year,
        outstanding_count: row.outstanding_count ?? 0,
        last_sent_at: lastLog?.created_at || null,
        last_sent_channel: lastLog?.channel || null,
        last_sent_status: status,
        sent_count: lastLog?.sent_count || 0,
        failed_count: lastLog?.failed_count || 0,
        notification_sent: !!lastLog && status !== 'processing' && status !== 'failed',
        notification_processing: status === 'processing',
        notification_failed: status === 'failed',
        notification_partial: status === 'partial',
      };
    })
  );

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.notification.feeDueSummaryFetched,
    data: {
      sections: enriched,
      school_name: env.schoolName,
      school_phone: env.schoolPhone || '',
      academic_year: year,
    },
  };
}

export async function getFeeDueNotificationDetail({ classId, sectionId, academicYear }) {
  const classUuid = optUuid(classId);
  const sectionUuid = optUuid(sectionId);
  const year = optStr(academicYear);

  if (!classUuid) {
    return { statusCode: 400, success: false, message: 'classId is required', data: null };
  }
  if (!year) {
    return { statusCode: 400, success: false, message: 'academic_year is required', data: null };
  }

  const [stuRows, logRows, nameResult] = await Promise.all([
    callProcedure(SQL.feeDueStudents, [classUuid, sectionUuid, year]),
    callProcedure(SQL.lastLog, ['fee_due', classUuid, sectionUuid, null, null]),
    getClassSectionNames(classUuid, sectionUuid),
  ]);

  const stuResult = fromDbRow(stuRows?.[0]);
  if (!stuResult.success) return stuResult;

  const students = Array.isArray(stuResult.data) ? stuResult.data : [];
  const logResult = fromDbRow(logRows?.[0]);
  const lastLog = logResult.success ? logResult.data : null;
  const detailLogStatus = lastLog?.status || null;
  const logId = lastLog?.id || null;
  const recipientMap = await getRecipientStatusMap(logId);

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.notification.feeDueDetailFetched,
    data: {
      students: students.map((s) => {
        const rStatus = recipientMap[s.student_id];
        const status =
          rStatus?.status ||
          (detailLogStatus === 'processing' ? 'processing' : 'pending');
        return {
          ...s,
          notification_status: status,
          notification_error: rStatus?.error_reason || null,
          notification_sent: status === 'sent',
          notification_processing: status === 'processing',
          notification_failed: status === 'failed',
        };
      }),
      section: {
        class_id: classUuid,
        class_name: nameResult.class_name,
        section_id: sectionUuid || null,
        section_label: nameResult.section_code || null,
        academic_year: year,
        school_name: env.schoolName,
        school_phone: env.schoolPhone || '',
        last_sent_at: lastLog?.created_at || null,
        last_sent_channel: lastLog?.channel || null,
        last_sent_status: detailLogStatus,
        last_log_id: logId,
        sent_count: lastLog?.sent_count || 0,
        failed_count: lastLog?.failed_count || 0,
      },
    },
  };
}

export async function sendFeeDueNotification({
  classId,
  sectionId,
  academicYear,
  studentIds,
  dueDate,
  channel,
  actorUserId,
}) {
  const classUuid = optUuid(classId);
  const sectionUuid = optUuid(sectionId);
  const year = optStr(academicYear);
  const ch = optStr(channel) || 'whatsapp';
  const dueDateIso = optStr(dueDate);
  const requestedIds = Array.isArray(studentIds)
    ? [...new Set(studentIds.map((id) => optUuid(id)).filter(Boolean))]
    : [];

  if (!classUuid) {
    return { statusCode: 400, success: false, message: 'classId is required', data: null };
  }
  if (!year) {
    return { statusCode: 400, success: false, message: 'academic_year is required', data: null };
  }
  if (!['sms', 'whatsapp'].includes(ch)) {
    return { statusCode: 400, success: false, message: 'channel must be sms or whatsapp', data: null };
  }
  if (requestedIds.length === 0) {
    return { statusCode: 400, success: false, message: 'studentIds is required', data: null };
  }

  const stuRows = await callProcedure(SQL.feeDueStudents, [classUuid, sectionUuid, year]);
  const stuResult = fromDbRow(stuRows?.[0]);
  if (!stuResult.success) return stuResult;

  const allStudents = Array.isArray(stuResult.data) ? stuResult.data : [];
  const byId = {};
  for (const s of allStudents) byId[s.student_id] = s;

  const selected = requestedIds
    .map((id) => byId[id])
    .filter((s) => s && Number(s.balance) > 0 && optStr(s.guardian_phone));

  if (selected.length === 0) {
    return {
      statusCode: 200,
      success: true,
      message: MESSAGES.notification.noOutstandingFees,
      data: { sent: 0, failed: 0 },
    };
  }

  const dueText = formatFeeDueDateForMessage(dueDateIso);
  const studentsWithVariables = selected.map((s) => ({
    student_id: s.student_id,
    mobile: s.guardian_phone,
    variables: {
      fee_due: true,
      student_name: s.student_name,
      guardian_name: s.guardian_name || '',
      due_date: dueText,
      pending_amount: formatPendingAmount(s.balance),
      school_name: env.schoolName,
      school_phone: env.schoolPhone || '',
    },
  }));

  const templateName = ch === 'whatsapp' ? env.msg91.whatsappFeeDueTemplate : undefined;

  const previewMsg = buildFeeDuePreviewMessage({
    studentName: studentsWithVariables[0].variables.student_name,
    balance: selected[0].balance,
    dueDateIso,
  });

  const logRows = await callProcedure(SQL.insertLog, [
    'fee_due',
    ch,
    null,
    null,
    classUuid,
    sectionUuid || null,
    studentsWithVariables.length,
    'processing',
    previewMsg,
    optUuid(actorUserId),
  ]);
  const logResult = fromDbRow(logRows?.[0]);
  const logId = logResult.data?.id;

  if (!logId) {
    return { statusCode: 500, success: false, message: MESSAGES.common.failedToCreateLog, data: null };
  }

  const recipientRows = await insertRecipientsAndGetRows(logId, studentsWithVariables);
  spawnWorker({ batches: [{ logId, recipientRows }], channel: ch, templateName });

  return {
    statusCode: 202,
    success: true,
    message: `Sending ${studentsWithVariables.length} notification${studentsWithVariables.length !== 1 ? 's' : ''} in the background`,
    data: { queued: studentsWithVariables.length, logId },
  };
}

// ─── Retry Failed ────────────────────────────────────────────────────

export async function retryFailedNotifications({ logId, actorUserId }) {
  const logUuid = optUuid(logId);
  if (!logUuid) {
    return { statusCode: 400, success: false, message: 'logId is required', data: null };
  }

  const logRow = await query(
    'SELECT id, type, channel, status, reference_date, reference_id, class_id, section_id, created_at FROM notification_logs WHERE id = $1 LIMIT 1',
    [logUuid]
  );
  if (!logRow || logRow.length === 0) {
    return { statusCode: 404, success: false, message: MESSAGES.notification.logNotFound, data: null };
  }

  const log = logRow[0];

  const isStaleProcessing = log.status === 'processing' && log.created_at < new Date(Date.now() - 5 * 60 * 1000);
  if (log.status === 'processing' && !isStaleProcessing) {
    return { statusCode: 400, success: false, message: MESSAGES.notification.stillProcessing, data: null };
  }

  if (isStaleProcessing) {
    await query(
      `UPDATE notification_logs SET status = 'failed' WHERE id = $1`,
      [logUuid]
    );
    await query(
      `UPDATE notification_recipients SET status = 'failed', error_reason = 'Worker timed out' WHERE log_id = $1 AND status = 'pending'`,
      [logUuid]
    );
  }

  const failedRows = await query(
    `SELECT nr.id AS recipient_id, nr.student_id, nr.guardian_phone
     FROM notification_recipients nr
     WHERE nr.log_id = $1 AND nr.status = 'failed'`,
    [logUuid]
  );

  if (!failedRows || failedRows.length === 0) {
    return { statusCode: 200, success: true, message: MESSAGES.notification.noFailedRecipients, data: { retried: 0 } };
  }

  const ch = log.channel;
  const isExam = log.type === 'exam_result';
  const isFeeDue = log.type === 'fee_due';

  const templateName = ch === 'whatsapp'
    ? (isFeeDue
      ? env.msg91.whatsappFeeDueTemplate
      : isExam
        ? env.msg91.whatsappExamTemplate
        : env.msg91.whatsappAttendanceTemplate)
    : undefined;

  await query(
    `UPDATE notification_recipients SET status = 'pending', error_reason = NULL WHERE log_id = $1 AND status = 'failed'`,
    [logUuid]
  );

  await query(
    `UPDATE notification_logs SET status = 'processing' WHERE id = $1`,
    [logUuid]
  );

  let recipientRows;

  if (isFeeDue) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const academicYear = m >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;

    const stuRows = await callProcedure(SQL.feeDueStudents, [
      log.class_id,
      log.section_id || null,
      academicYear,
    ]);
    const stuResult = fromDbRow(stuRows?.[0]);
    const students = stuResult.success && Array.isArray(stuResult.data) ? stuResult.data : [];
    const stuMap = {};
    for (const s of students) { stuMap[s.student_id] = s; }

    const recipientDataRows = await query(
      `SELECT nr.id AS recipient_id, nr.guardian_phone AS mobile, nr.student_id
       FROM notification_recipients nr
       WHERE nr.log_id = $1 AND nr.status = 'pending'`,
      [logUuid]
    );

    recipientRows = recipientDataRows.map((r) => {
      const stu = stuMap[r.student_id] || {};
      return {
        recipient_id: r.recipient_id,
        mobile: r.mobile,
        variables: {
          fee_due: true,
          student_name: stu.student_name || '',
          guardian_name: stu.guardian_name || '',
          due_date: FEE_DUE_DATE_FALLBACK,
          pending_amount: formatPendingAmount(stu.balance ?? 0),
          school_name: env.schoolName,
          school_phone: env.schoolPhone || '',
        },
      };
    });
  } else if (isExam && log.reference_id) {
    const examRows = await callProcedure(SQL.getExamById, [log.reference_id]);
    const examResult = fromDbRow(examRows?.[0]);
    const exam = examResult.success ? examResult.data : null;

    const candRows = await callProcedure(SQL.examCandidates, [log.reference_id]);
    const candResult = fromDbRow(candRows?.[0]);
    const candidates = candResult.success && Array.isArray(candResult.data) ? candResult.data : [];
    const candMap = {};
    for (const c of candidates) { candMap[c.student_id] = c; }

    const recipientDataRows = await query(
      `SELECT nr.id AS recipient_id, nr.guardian_phone AS mobile, nr.student_id
       FROM notification_recipients nr
       WHERE nr.log_id = $1 AND nr.status = 'pending'`,
      [logUuid]
    );

    recipientRows = recipientDataRows.map((r) => {
      const cand = candMap[r.student_id] || {};
      const pct = exam?.max_marks > 0 ? ((cand.total_marks / exam.max_marks) * 100).toFixed(1) : '—';
      return {
        recipient_id: r.recipient_id,
        mobile: r.mobile,
        variables: {
          student_name: cand.student_name || '',
          guardian_name: cand.father_name || cand.guardian_name || '',
          school_name: env.schoolName,
          exam_name: exam?.test_name || 'Exam',
          exam_date: fmtDate(exam?.exam_date),
          total_marks: String(cand.total_marks ?? '—'),
          max_marks: String(exam?.max_marks ?? '—'),
          percentage: pct,
          subject_marks: cand.subject_marks || [],
        },
      };
    });
  } else {
    const dateStr = log.reference_date ? String(log.reference_date).split('T')[0] : '';

    const absentRows = await callProcedure(SQL.sectionAbsentStudents, [
      log.class_id, log.section_id || null, dateStr,
    ]);
    const absentResult = fromDbRow(absentRows?.[0]);
    const absentStudents = absentResult.success && Array.isArray(absentResult.data) ? absentResult.data : [];
    const absentMap = {};
    for (const a of absentStudents) { absentMap[a.student_id] = a; }

    const recipientDataRows = await query(
      `SELECT nr.id AS recipient_id, nr.guardian_phone AS mobile, nr.student_id
       FROM notification_recipients nr
       WHERE nr.log_id = $1 AND nr.status = 'pending'`,
      [logUuid]
    );

    recipientRows = recipientDataRows.map((r) => {
      const stu = absentMap[r.student_id] || {};
      const slotText = (stu.absent_slots || []).length > 0
        ? stu.absent_slots.join(', ')
        : '';
      return {
        recipient_id: r.recipient_id,
        mobile: r.mobile,
        variables: {
          student_name: stu.student_name || '',
          guardian_name: stu.father_name || stu.guardian_name || '',
          date: fmtDate(dateStr),
          slots: slotText,
          school_name: env.schoolName,
        },
      };
    });
  }

  spawnWorker({ batches: [{ logId: logUuid, recipientRows }], channel: ch, templateName });

  return {
    statusCode: 202,
    success: true,
    message: `Retrying ${recipientRows.length} failed notification${recipientRows.length !== 1 ? 's' : ''}`,
    data: { retried: recipientRows.length },
  };
}

// ─── Logs ────────────────────────────────────────────────────────────

export async function getNotificationLogs({ type, page, limit }) {
  const lim = optInt(limit) || 20;
  const pg = optInt(page) || 1;
  const offset = (pg - 1) * lim;

  const rows = await callProcedure(SQL.listLogs, [optStr(type), lim, offset]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.notification.logsFetched,
    data: {
      items: result.data?.items ?? [],
      total: result.data?.total ?? 0,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function getClassSectionNames(classId, sectionId) {
  try {
    const classRows = await query('SELECT name FROM classes WHERE id = $1 LIMIT 1', [classId]);
    const className = classRows?.[0]?.name || null;

    let sectionCode = null;
    if (sectionId) {
      const secRows = await query('SELECT section_code FROM sections WHERE id = $1 LIMIT 1', [sectionId]);
      sectionCode = secRows?.[0]?.section_code || null;
    }

    return { class_name: className, section_code: sectionCode };
  } catch {
    return { class_name: null, section_code: null };
  }
}
