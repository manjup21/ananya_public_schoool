export const STUDENT_GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const STUDENT_RESIDENCE_TYPE_OPTIONS = [
  { value: 'day_scholar', label: 'Day Scholar' },
  { value: 'hosteller', label: 'Hosteller' },
];

function optionLabel(value, options) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '—';
  const hit = options.find((o) => o.value === raw);
  return hit?.label ?? '—';
}

export function formatStudentGender(value) {
  return optionLabel(value, STUDENT_GENDER_OPTIONS);
}

/** Accepts a residence_type string or a student object with `residence_type`. */
export function formatStudentResidenceType(valueOrStudent) {
  const value =
    valueOrStudent != null && typeof valueOrStudent === 'object'
      ? valueOrStudent.residence_type
      : valueOrStudent;
  return optionLabel(value, STUDENT_RESIDENCE_TYPE_OPTIONS);
}
