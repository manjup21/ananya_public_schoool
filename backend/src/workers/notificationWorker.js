/**
 * Worker thread that sends queued notifications via MSG91 in the background.
 *
 * workerData: { channel, templateName, batches: [{ logId, recipientRows: [{ recipient_id, mobile, variables }] }] }
 * Each batch maps to one notification_logs row; recipients are sent one-by-one and
 * their notification_recipients rows updated, then the log gets its final status.
 */

import { workerData, parentPort } from 'worker_threads';
import { pool, query } from '../db/db.js';
import { env } from '../utils/env.js';

const { batches, channel, templateName } = workerData;

const WHATSAPP_BULK_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

function normalizeMobile(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
}

function formatSubjectMarks(subjectMarks) {
  if (!Array.isArray(subjectMarks) || subjectMarks.length === 0) return '—';
  return subjectMarks
    .map((sm) => {
      const name = sm.subject_name || 'Subject';
      if (sm.is_absent) return `${name}-Absent`;
      if (sm.is_part_b || (sm.grade_text != null && String(sm.grade_text).trim() !== '')) {
        const g = String(sm.grade_text ?? '').trim() || '—';
        return `${name}-${g}`;
      }
      return `${name}-${sm.mark ?? '—'}`;
    })
    .join(', ');
}

const text = (value) => ({ type: 'text', value: String(value) });

function buildWhatsAppComponents(variables) {
  if (variables.exam_name !== undefined) {
    return {
      body_1: text(variables.exam_name || ''),
      body_2: text(variables.student_name || ''),
      body_3: text(variables.exam_date || ''),
      body_4: text(formatSubjectMarks(variables.subject_marks)),
      body_5: text(variables.total_marks || '—'),
      body_6: text(variables.max_marks || '—'),
      body_7: text(variables.percentage || '—'),
      body_8: text(variables.school_name || ''),
    };
  }
  if (variables.fee_due === true || variables.pending_amount !== undefined) {
    return {
      body_1: text(variables.student_name || ''),
      body_2: text(variables.due_date || 'the earliest'),
      body_3: text(variables.pending_amount || '0'),
      body_4: text(variables.school_phone || env.schoolPhone),
    };
  }
  return {
    body_1: text(variables.student_name || ''),
    body_2: text(variables.date || ''),
    body_3: text(variables.slots || 'Full day'),
    body_4: text(variables.school_name || ''),
  };
}

async function sendWhatsAppMessage(mobile, variables) {
  if (!env.msg91.authKey) {
    return { success: false, reason: 'MSG91_AUTH_KEY not configured' };
  }

  const normalizedMobile = normalizeMobile(mobile);
  if (!normalizedMobile) {
    return { success: false, reason: 'Invalid mobile number' };
  }

  const payload = {
    integrated_number: env.msg91.integratedNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en', policy: 'deterministic' },
        namespace: env.msg91.namespace,
        to_and_components: [{ to: [normalizedMobile], components: buildWhatsAppComponents(variables) }],
      },
    },
  };

  try {
    const response = await fetch(WHATSAPP_BULK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: env.msg91.authKey },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { data = body; }

    if (!response.ok) {
      console.error('[notificationWorker] MSG91 API error', response.status, data);
      return { success: false, reason: `API ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

function sendMessage(mobile, variables) {
  if (channel === 'whatsapp') return sendWhatsAppMessage(mobile, variables);
  return Promise.resolve({ success: false, reason: 'SMS not configured yet' });
}

async function processBatch({ logId, recipientRows }) {
  let sent = 0;
  let failed = 0;

  for (const row of recipientRows) {
    let rowStatus = 'failed';
    let errorReason = null;

    try {
      const result = await sendMessage(row.mobile, row.variables);
      if (result.success) {
        sent++;
        rowStatus = 'sent';
      } else {
        failed++;
        errorReason = result.reason || 'Send failed';
      }
    } catch (err) {
      failed++;
      errorReason = err.message || 'Unknown error';
    }

    try {
      await query(
        'SELECT * FROM public.atr_update_notification_recipient($1::uuid, $2::varchar, $3::text)',
        [row.recipient_id, rowStatus, errorReason]
      );
    } catch (dbErr) {
      console.error('[notificationWorker] Failed to update recipient', row.recipient_id, dbErr.message);
    }
  }

  const status = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial';

  try {
    await query('SELECT * FROM public.atr_update_notification_log($1::uuid, $2::int, $3::varchar)', [logId, null, status]);
    console.log(`[notificationWorker] Log ${logId}: ${sent} sent, ${failed} failed (${status})`);
  } catch (err) {
    console.error('[notificationWorker] Failed to update log', logId, err.message);
  }

  return { sent, failed };
}

async function run() {
  let sent = 0;
  let failed = 0;

  for (const batch of batches) {
    const result = await processBatch(batch);
    sent += result.sent;
    failed += result.failed;
  }

  await pool.end();
  parentPort?.postMessage({ sent, failed, sections: batches.length });
}

run().catch((err) => {
  console.error('[notificationWorker] Fatal error', err);
  pool.end().catch(() => {});
  process.exit(1);
});
