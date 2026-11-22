/**
 * Build a human-readable filter summary for student export meta rows / filenames.
 */
export function buildStudentExportFilterLabel({
  searchQuery,
  classId,
  sectionId,
  classes,
}) {
  const parts = [];
  if (classId) {
    const cls = (classes ?? []).find((c) => c.id === classId);
    parts.push(`Class: ${cls?.name ?? '—'}`);
  }
  if (sectionId) {
    const cls = (classes ?? []).find((c) => c.id === classId);
    const sec = cls?.sections?.find((s) => s.id === sectionId);
    parts.push(`Section: ${sec?.section ?? '—'}`);
  }
  const q = String(searchQuery ?? '').trim();
  if (q) parts.push(`Search: ${q}`);
  return parts.length ? parts.join(' · ') : 'All students';
}

/**
 * Same filter logic as StudentManagement list (client-side).
 */
export function filterStudentsForExport(students, { searchQuery, classId, sectionId }) {
  const items = Array.isArray(students) ? students : [];
  const s = String(searchQuery ?? '').trim().toLowerCase();
  return items.filter((st) => {
    if (classId && st.class_id !== classId) return false;
    if (sectionId && st.section_id !== sectionId) return false;
    if (!s) return true;
    const name = [st.first_name, st.last_name].filter(Boolean).join(' ').toLowerCase();
    const roll = String(st.roll_number ?? '').toLowerCase();
    const phone = String(st.guardian_phone ?? '').toLowerCase();
    return name.includes(s) || roll.includes(s) || phone.includes(s);
  });
}
