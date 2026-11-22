const EXAM_STATUS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Enter results — only scheduled exams can receive marks. */
export const ENTER_RESULTS_EXAM_STATUS = EXAM_STATUS.filter((s) => s.value === 'scheduled');

/** View / export results — only completed exams have published marks. */
export const VIEW_EXPORT_EXAM_STATUS = EXAM_STATUS.filter((s) => s.value === 'completed');

export function toTime24(d) {
  if (!(d instanceof Date)) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

export function time12(timeStr) {
  if (!timeStr) return '—';
  const [hhStr, mmStr] = String(timeStr).split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return String(timeStr);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}-${m}-${y}`;
}

export function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled') return { variant: 'destructive', className: '', label: 'Cancelled' };
  if (s === 'completed') return { variant: 'secondary', className: 'bg-green-50 text-green-700', label: 'Completed' };
  return { variant: 'secondary', className: 'bg-amber-50 text-amber-700', label: 'Scheduled' };
}

export function formatExamStatus(status) {
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return '—';
  return EXAM_STATUS.find((x) => x.value === s)?.label ?? statusBadge(status).label;
}

export function normalizeSectionIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Returns the human-friendly section label for an examination, combining
 * `section_id` (single) and `section_ids` (multi) representations.
 */
export function sectionLabelForExam(exam, classes) {
  const byId = (classId, sectionId) => {
    if (!sectionId) return 'All';
    return classes.find((c) => c.id === classId)?.sections?.find((s) => s.id === sectionId)?.section ?? '—';
  };
  const single = exam?.section_id ? byId(exam.class_id, exam.section_id) : null;
  if (single && single !== '—') return single;
  const ids = normalizeSectionIds(exam?.section_ids);
  if (!ids.length) return 'All';
  const labels = ids.map((sid) => byId(exam.class_id, sid)).filter((x) => x && x !== '—');
  return labels.length ? labels.join(', ') : 'Selected';
}

export function classNameById(classes, classId) {
  return classes.find((c) => c.id === classId)?.name ?? '—';
}

export function classSectionLabel(exam, classes) {
  const cls = (classes ?? []).find((c) => String(c.id) === String(exam?.class_id));
  const className = cls?.name ?? '—';
  const secId = exam?.section_id != null && String(exam.section_id).trim() !== '' ? String(exam.section_id) : null;
  if (secId) {
    const section = cls?.sections?.find((s) => String(s.id) === String(secId))?.section ?? '—';
    return `${className} · ${section}`;
  }
  const ids = Array.isArray(exam?.section_ids) ? exam.section_ids.filter(Boolean) : [];
  if (ids.length) {
    const labels = ids
      .map((sid) => cls?.sections?.find((s) => String(s.id) === String(sid))?.section)
      .filter(Boolean);
    return `${className} · ${labels.length ? labels.join(', ') : 'Selected sections'}`;
  }
  return `${className} · All sections`;
}
