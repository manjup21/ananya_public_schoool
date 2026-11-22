export function sanitizeLecturerNameInput(raw) {
  return String(raw ?? '')
    .replace(/[^A-Za-z ]+/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeIndiaPhone(raw) {
  const s = String(raw ?? '');
  const digits = s.replace(/\D/g, '');
  const ten = digits.startsWith('91') ? digits.slice(2, 12) : digits.slice(0, 10);
  return `+91${ten}`;
}

/**
 * Runs the same required-field / phone-shape validation used by both the Add
 * and Edit lecturer forms. Returns an { errors, message } shape.
 */
export function validateLecturerForm({ title, firstName, lastName, email, phone, employeeId, dateOfBirth, subjects }) {
  const errors = {};
  if (!title) errors.title = 'Title is required';
  if (!firstName?.trim()) errors.firstName = 'First name is required';
  if (!lastName?.trim()) errors.lastName = 'Last name is required';
  if (!employeeId?.trim()) errors.employeeId = 'Employee ID is required';
  if (!email?.trim()) errors.email = 'Email is required';
  if (!phone?.trim()) errors.phone = 'Phone is required';
  else if (!phone.startsWith('+91') || !/^\+91\d{10}$/.test(phone)) {
    errors.phone = 'Phone must be +91 followed by 10 digits';
  }
  if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
  if (!Array.isArray(subjects) || !subjects.length) {
    errors.subjects = 'Please add at least one subject';
  }

  const ok = Object.keys(errors).length === 0;
  return { ok, errors };
}
