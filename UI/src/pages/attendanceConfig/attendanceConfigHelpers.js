export const SCOPE_OPTIONS = [
  { value: 'all', label: 'All scopes' },
  { value: 'global', label: 'Global' },
  { value: 'class', label: 'Class' },
  { value: 'section', label: 'Section' },
];

export const SCOPE_FORM_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'class', label: 'Class' },
  { value: 'section', label: 'Section' },
];

export const DOW = [
  { id: 1, short: 'Mon', label: 'Monday' },
  { id: 2, short: 'Tue', label: 'Tuesday' },
  { id: 3, short: 'Wed', label: 'Wednesday' },
  { id: 4, short: 'Thu', label: 'Thursday' },
  { id: 5, short: 'Fri', label: 'Friday' },
  { id: 6, short: 'Sat', label: 'Saturday' },
  { id: 0, short: 'Sun', label: 'Sunday' },
];

export function scopeLabel(scope) {
  if (scope === 'global') return 'Global';
  if (scope === 'class') return 'Class';
  if (scope === 'section') return 'Section';
  return String(scope ?? '—');
}

export function classNameById(classes, id) {
  return classes.find((c) => c.id === id)?.name ?? '—';
}

export function sectionNameById(classes, classId, sectionId) {
  if (!sectionId) return 'All sections';
  return (
    classes.find((c) => c.id === classId)?.sections?.find((s) => s.id === sectionId)?.section ?? '—'
  );
}

export function daysCompact(days) {
  const set = new Set(days ?? []);
  return DOW.filter((d) => set.has(d.id)).map((d) => d.short).join(' ');
}

/** Slots may arrive as an array or as a JSON string from the API. */
export function normalizeSlotsArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function fmtDateRange(startIso, endIso) {
  const s = String(startIso ?? '').trim() || '—';
  const e = String(endIso ?? '').trim() || '—';
  return `${s} → ${e}`;
}

