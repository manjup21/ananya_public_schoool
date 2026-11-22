/** Notifications are sent via WhatsApp only (MSG91). */
export const NOTIFICATION_CHANNEL = 'whatsapp';

/** Set to true to block Send / Resend / Retry (e.g. while MSG91 is not configured). */
export const NOTIFICATIONS_SEND_DISABLED = false;
export const NOTIFICATIONS_SEND_DISABLED_TITLE = 'Sending disabled';

export function fmtDate(iso) {
  if (!iso) return '\u2014';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

export function fmtDateLong(iso) {
  if (!iso) return '\u2014';
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

export function slotLabel(slotIndex) {
  return `Period ${slotIndex}`;
}

export function buildAttendanceMessage({ studentName, date, slots, schoolName, channel }) {
  const school = schoolName || 'School';
  const student = studentName || 'your child';
  const dateStr = fmtDate(date);
  const dateLong = fmtDateLong(date);

  if (channel === 'whatsapp') {
    const slotLines = (slots || []).length > 0
      ? slots.map((s) => `• Period ${s}`).join('\n')
      : '• Full day';
    return [
      `*Attendance Alert* — ${school}`,
      '',
      'Dear Parent,',
      '',
      `This is to inform you that your child *${student}* was marked absent on *${dateLong}* for the following periods:`,
      slotLines,
      '',
      'If you believe this is an error, please contact the school office.',
      '',
      'Thank you,',
      school,
    ].join('\n');
  }

  const slotStr = (slots || []).length > 0
    ? ` (Period ${slots.join(',')})` : '';
  return `Your child ${student} was absent on ${dateStr}${slotStr}. For details contact school. -${school}`;
}

export function buildExamResultMessage({ studentName, examName, examDate, totalMarks, maxMarks, schoolName, channel, subjectMarks }) {
  const school = schoolName || 'School';
  const student = studentName || 'your child';
  const exam = examName || 'Exam';
  const marks = totalMarks ?? '\u2014';
  const max = maxMarks ?? '\u2014';
  const pctVal = maxMarks > 0 ? ((totalMarks / maxMarks) * 100).toFixed(1) : null;

  if (channel === 'whatsapp') {
    const dateLine = examDate ? `\nDate: *${fmtDateLong(examDate)}*` : '';
    const pctLine = pctVal ? `\nPercentage: *${pctVal}%*` : '';

    const subjectLines = (subjectMarks || []).map((sm) => {
      if (sm.is_absent) return `• ${sm.subject_name}: _Absent_`;
      if (sm.is_part_b || (sm.grade_text != null && String(sm.grade_text).trim() !== '')) {
        return `• ${sm.subject_name}: *${String(sm.grade_text).trim() || '—'}*`;
      }
      const m = sm.mark ?? '\u2014';
      const mx = sm.max_marks ?? '\u2014';
      return `• ${sm.subject_name}: *${m}*/${mx}`;
    });

    const lines = [
      `*Exam Result* \u2014 ${school}`,
      '',
      'Dear Parent,',
      '',
      `The results for *${exam}* are now available.`,
      '',
      `Student: *${student}*${dateLine}`,
    ];

    if (subjectLines.length > 0) {
      lines.push('', '*Subject-wise Marks:*', ...subjectLines);
    }

    lines.push(
      '',
      `*Total: ${marks} / ${max}*${pctLine}`,
      '',
      'For any queries, please contact the school office.',
      '',
      'Thank you,',
      school
    );
    return lines.join('\n');
  }

  const dateStr = examDate ? ` on ${fmtDate(examDate)}` : '';
  const pct = pctVal ? ` (${pctVal}%)` : '';
  return `${student} scored ${marks}/${max}${pct} in ${exam}${dateStr}. For details contact school. -${school}`;
}

/** Fallback for MSG91 Fees Alert {{2}} when no due date is chosen in the UI. */
export const FEE_DUE_DATE_FALLBACK = 'the earliest';

export function formatFeeDueDateForMessage(dueDate) {
  if (!dueDate) return FEE_DUE_DATE_FALLBACK;
  return fmtDateLong(dueDate);
}

/**
 * Matches MSG91 WhatsApp template "Fees Alert":
 * {{1}} student name, {{2}} due date, {{3}} pending amount, {{4}} office phone
 */
export function buildFeeDueMessage({
  studentName,
  balance,
  dueDate,
  schoolName,
  schoolPhone,
  channel,
}) {
  const school = schoolName || 'Ananya Public School';
  const student = studentName || 'your child';
  const amount = balance != null
    ? Number(balance).toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : '0';
  const dueText = formatFeeDueDateForMessage(dueDate);
  const office = String(schoolPhone || '').trim() || 'the school office';

  if (channel === 'whatsapp') {
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

  return `Fees for ${student} due on ${dueText}. Pending: Rs.${amount}. Contact ${office}. -${school}`;
}

export function channelLabel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp';
  return channel ? String(channel) : 'WhatsApp';
}

export function fmtDateTime(isoOrTimestamp) {
  if (!isoOrTimestamp) return '\u2014';
  try {
    const d = new Date(isoOrTimestamp);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(isoOrTimestamp);
  }
}
