import { formatDateOnlyLocal, parseApiDateOnly } from '../../utils/dateOnly';
import { PASSPORT_PHOTO } from '../../utils/passportPhoto';

/**
 * Shared helpers for the Student form (Add + Edit dialogs).
 * Extracted from StudentManagement.jsx so add/edit flows share a single
 * source of truth for defaults, validation, and normalisation.
 */

const emptyStudentForm = Object.freeze({
  gender: '',
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  rollNumber: '',
  classId: '',
  sectionId: '',
  addressLocation: '',
  addressCity: '',
  addressDistrict: '',
  addressState: '',
  addressPin: '',
  fatherName: '',
  motherName: '',
  guardianEmail: '',
  guardianPhone: '+91',
  emergencyContactNumber: '',
  bloodGroup: '',
  residenceType: '',
  specialisation: '',
  photoFile: null,
  photoPreviewUrl: '',
  existingPhotoPath: null,
  removeExistingPhoto: false,
});

/** Final upload cap (matches API). Raw picks may be larger; they are processed first. */
const STUDENT_PHOTO_MAX_BYTES = PASSPORT_PHOTO.maxProcessedBytes;
export const STUDENT_PHOTO_ACCEPT = PASSPORT_PHOTO.accept;
const STUDENT_PHOTO_MIME_TYPES = Object.freeze([...PASSPORT_PHOTO.mimeTypes]);

/**
 * Validates an optional passport photo File (raw pick or already-processed).
 * @returns {string|null} error message or null if ok / no file
 */
export function validateStudentPhotoFile(file, { rawPick = false } = {}) {
  if (!file) return null;
  const type = String(file.type || '').toLowerCase();
  if (type && !STUDENT_PHOTO_MIME_TYPES.includes(type)) {
    return 'Photo must be a JPEG, PNG, or WebP image';
  }
  const limit = rawPick ? PASSPORT_PHOTO.maxUploadBytes : STUDENT_PHOTO_MAX_BYTES;
  if (file.size > limit) {
    return rawPick ? 'Photo must be 5 MB or smaller' : 'Photo must be 1MB or smaller';
  }
  return null;
}

export function createEmptyStudentForm() {
  return { ...emptyStudentForm };
}

export function sanitizeNameInput(raw) {
  return String(raw ?? '')
    .replace(/[^A-Za-z ]+/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeIndiaPhone(raw, { allowEmpty } = { allowEmpty: false }) {
  const s = String(raw ?? '');
  const digits = s.replace(/\D/g, '');
  if (!digits) return allowEmpty ? '' : '+91';
  const ten = digits.startsWith('91') ? digits.slice(2, 12) : digits.slice(0, 10);
  if (!ten) return allowEmpty ? '' : '+91';
  return `+91${ten}`;
}

/**
 * Returns null if the form is valid, otherwise a user-facing error message.
 * @param {object} form
 * @param {{ classSections?: Array<{ id: string }> }} [options]
 */
export function validateStudentForm(form, { classSections = [] } = {}) {
  const requiredMissing =
    !form.gender ||
    !form.firstName ||
    !form.dateOfBirth ||
    !form.rollNumber ||
    !form.classId ||
    !form.fatherName ||
    !form.guardianPhone ||
    !form.residenceType;

  if (requiredMissing) return 'Please fill all required fields (*)';

  if (classSections.length > 0 && !form.sectionId) {
    return 'Please select a section for this class';
  }

  const lastName = String(form.lastName ?? '').trim();
  if (lastName && !/^[A-Za-z ]+$/.test(lastName)) {
    return 'Last name must contain only English letters';
  }
  if (lastName.length > 100) return 'Last name must be <= 100 characters';

  const roll = String(form.rollNumber ?? '').trim();
  if (roll.length < 1 || roll.length > 50) return 'Roll number is required (max 50 characters)';
  if (!/^[A-Za-z0-9_-]+$/.test(roll)) return 'Roll number can only contain letters, numbers, "-" and "_"';

  const fatherName = String(form.fatherName ?? '').trim();
  if (!fatherName) return 'Father name is required';
  if (!/^[A-Za-z ]+$/.test(fatherName)) return 'Father name must contain only English letters';
  if (fatherName.length > 150) return 'Father name must be <= 150 characters';

  const motherName = String(form.motherName ?? '').trim();
  if (motherName) {
    if (!/^[A-Za-z ]+$/.test(motherName)) return 'Mother name must contain only English letters';
    if (motherName.length > 150) return 'Mother name must be <= 150 characters';
  }

  const guardianPhone = String(form.guardianPhone ?? '').trim();
  if (!guardianPhone) return 'Guardian phone is required';
  if (!guardianPhone.startsWith('+91') || !/^\+91\d{10}$/.test(guardianPhone)) {
    return 'Guardian phone must be +91 followed by 10 digits';
  }

  const guardianEmail = String(form.guardianEmail ?? '').trim();
  if (guardianEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) return 'Guardian email is invalid';
  }

  const emergency = String(form.emergencyContactNumber ?? '').trim();
  if (emergency) {
    if (!emergency.startsWith('+91') || !/^\+91\d{10}$/.test(emergency)) {
      return 'Emergency contact must be +91 followed by 10 digits';
    }
  }

  const pin = String(form.addressPin ?? '').trim();
  if (pin) {
    if (!/^\d{6}$/.test(pin)) return 'PIN must be 6 digits';
  }

  const loc = String(form.addressLocation ?? '').trim();
  if (loc && loc.length > 200) return 'Address location must be <= 200 characters';
  const city = String(form.addressCity ?? '').trim();
  if (city && city.length > 100) return 'City must be <= 100 characters';
  const district = String(form.addressDistrict ?? '').trim();
  if (district && district.length > 100) return 'District must be <= 100 characters';
  const state = String(form.addressState ?? '').trim();
  if (state && state.length > 100) return 'State must be <= 100 characters';

  return null;
}

/**
 * Convert UI form state into the API payload (snake_case) used by
 * createStudent / updateStudent thunks.
 */
export function toStudentPayload(form) {
  const dob =
    form.dateOfBirth instanceof Date
      ? formatDateOnlyLocal(form.dateOfBirth)
      : String(form.dateOfBirth ?? '').trim();

  return {
    gender: form.gender,
    first_name: form.firstName,
    last_name: String(form.lastName ?? '').trim() || null,
    date_of_birth: dob,
    roll_number: form.rollNumber,
    class_id: form.classId,
    section_id: form.sectionId || null,
    address_location: form.addressLocation || null,
    address_city: form.addressCity || null,
    address_district: form.addressDistrict || null,
    address_state: form.addressState || null,
    address_pin: form.addressPin || null,
    father_name: form.fatherName,
    mother_name: String(form.motherName ?? '').trim() || null,
    guardian_email: form.guardianEmail || null,
    guardian_phone: form.guardianPhone,
    emergency_contact_number: form.emergencyContactNumber || null,
    blood_group: form.bloodGroup || null,
    residence_type: form.residenceType,
    specialisation: form.specialisation || null,
  };
}

/**
 * Convert an API student (snake_case) into UI form state (camelCase).
 */
export function fromStudentApi(full) {
  return {
    gender: full?.gender ?? '',
    firstName: full?.first_name ?? '',
    lastName: full?.last_name ?? '',
    dateOfBirth: parseApiDateOnly(full?.date_of_birth),
    rollNumber: full?.roll_number ?? '',
    classId: full?.class_id ?? '',
    sectionId: full?.section_id ?? '',
    addressLocation: full?.address_location ?? '',
    addressCity: full?.address_city ?? '',
    addressDistrict: full?.address_district ?? '',
    addressState: full?.address_state ?? '',
    addressPin: full?.address_pin ?? '',
    fatherName: full?.father_name ?? full?.guardian_name ?? '',
    motherName: full?.mother_name ?? '',
    guardianEmail: full?.guardian_email ?? '',
    guardianPhone: full?.guardian_phone ?? '',
    emergencyContactNumber: full?.emergency_contact_number ?? '',
    bloodGroup: full?.blood_group ?? '',
    residenceType: full?.residence_type ?? '',
    specialisation: full?.specialisation ?? '',
    photoFile: null,
    photoPreviewUrl: '',
    existingPhotoPath: full?.photo_path ?? null,
    removeExistingPhoto: false,
  };
}
