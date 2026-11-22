import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { UUID_REGEX } from '../utils/validators.js';

const PHONE_REGEX = /^\+91\d{10}$/;
const EN_NAME_REGEX = /^[A-Za-z ]+$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(v) {
  const s = String(v ?? '').trim();
  if (!DATE_ONLY_REGEX.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function normalizeName(v) {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

function isEnglishName(v) {
  const s = normalizeName(v);
  if (!s) return false;
  return EN_NAME_REGEX.test(s);
}

export function validateStudentIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, { success: false, message: MESSAGES.student?.invalidId ?? 'Valid student id (UUID) is required', data: null });
  }
  next();
}

export function validateCreateStudent(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.gender) || !['male', 'female', 'other'].includes(String(b.gender))) {
    return sendJson(res, 400, { success: false, message: 'Gender is required', data: null });
  }
  if (missing(b.first_name) || String(b.first_name).trim().length > 100) {
    return sendJson(res, 400, { success: false, message: 'First name is required (max 100 characters)', data: null });
  }
  if (!isEnglishName(b.first_name)) {
    return sendJson(res, 400, { success: false, message: 'First name must contain only English letters', data: null });
  }
  if (b.last_name !== undefined && b.last_name !== null && String(b.last_name).trim() !== '') {
    if (String(b.last_name).trim().length > 100) {
      return sendJson(res, 400, { success: false, message: 'Last name must be at most 100 characters', data: null });
    }
    if (!isEnglishName(b.last_name)) {
      return sendJson(res, 400, { success: false, message: 'Last name must contain only English letters', data: null });
    }
  }
  if (missing(b.date_of_birth) || !isValidDateOnly(b.date_of_birth)) {
    return sendJson(res, 400, { success: false, message: 'Valid date of birth is required (YYYY-MM-DD)', data: null });
  }
  if (missing(b.roll_number) || String(b.roll_number).trim().length > 50) {
    return sendJson(res, 400, { success: false, message: 'Roll number is required (max 50 characters)', data: null });
  }
  if (missing(b.class_id) || !UUID_REGEX.test(String(b.class_id))) {
    return sendJson(res, 400, { success: false, message: 'Valid class_id (UUID) is required', data: null });
  }
  if (b.section_id !== undefined && b.section_id !== null && String(b.section_id).trim() !== '' && !UUID_REGEX.test(String(b.section_id))) {
    return sendJson(res, 400, { success: false, message: 'section_id must be a valid UUID', data: null });
  }
  if (missing(b.father_name) || String(b.father_name).trim().length > 150) {
    return sendJson(res, 400, { success: false, message: 'Father name is required (max 150 characters)', data: null });
  }
  if (!isEnglishName(b.father_name)) {
    return sendJson(res, 400, { success: false, message: 'Father name must contain only English letters', data: null });
  }
  if (b.mother_name !== undefined && b.mother_name !== null && String(b.mother_name).trim() !== '') {
    if (String(b.mother_name).trim().length > 150) {
      return sendJson(res, 400, { success: false, message: 'Mother name must be at most 150 characters', data: null });
    }
    if (!isEnglishName(b.mother_name)) {
      return sendJson(res, 400, { success: false, message: 'Mother name must contain only English letters', data: null });
    }
  }
  if (missing(b.guardian_phone) || String(b.guardian_phone).trim().length > 30) {
    return sendJson(res, 400, { success: false, message: 'Guardian phone is required (max 30 characters)', data: null });
  }
  if (!PHONE_REGEX.test(String(b.guardian_phone).trim())) {
    return sendJson(res, 400, { success: false, message: 'Phone must be +91 followed by 10 digits', data: null });
  }
  if (missing(b.residence_type) || !['day_scholar', 'hosteller'].includes(String(b.residence_type))) {
    return sendJson(res, 400, { success: false, message: 'Residence type is required', data: null });
  }
  next();
}

export function validateUpdateStudent(req, res, next) {
  const b = req.body ?? {};
  if (b.gender !== undefined && b.gender !== null && !['male', 'female', 'other'].includes(String(b.gender))) {
    return sendJson(res, 400, { success: false, message: 'Invalid gender', data: null });
  }
  if (b.roll_number !== undefined && b.roll_number !== null && String(b.roll_number).trim().length > 50) {
    return sendJson(res, 400, { success: false, message: 'roll_number must be <= 50 characters', data: null });
  }
  if (b.class_id !== undefined && b.class_id !== null && !UUID_REGEX.test(String(b.class_id))) {
    return sendJson(res, 400, { success: false, message: 'class_id must be a valid UUID', data: null });
  }
  if (b.section_id !== undefined && b.section_id !== null && String(b.section_id).trim() !== '' && !UUID_REGEX.test(String(b.section_id))) {
    return sendJson(res, 400, { success: false, message: 'section_id must be a valid UUID', data: null });
  }
  if (b.residence_type !== undefined && b.residence_type !== null && !['day_scholar', 'hosteller'].includes(String(b.residence_type))) {
    return sendJson(res, 400, { success: false, message: 'Invalid residence type', data: null });
  }
  if (b.blood_group !== undefined && b.blood_group !== null && String(b.blood_group).trim() !== '' && !['A+','A-','B+','B-','AB+','AB-','O+','O-'].includes(String(b.blood_group))) {
    return sendJson(res, 400, { success: false, message: 'Invalid blood group', data: null });
  }
  if (b.guardian_phone !== undefined && b.guardian_phone !== null && String(b.guardian_phone).trim() !== '' && !PHONE_REGEX.test(String(b.guardian_phone).trim())) {
    return sendJson(res, 400, { success: false, message: 'Phone must be +91 followed by 10 digits', data: null });
  }
  if (b.first_name !== undefined && b.first_name !== null && String(b.first_name).trim() !== '' && !isEnglishName(b.first_name)) {
    return sendJson(res, 400, { success: false, message: 'First name must contain only English letters', data: null });
  }
  if (b.last_name !== undefined && b.last_name !== null && String(b.last_name).trim() !== '' && !isEnglishName(b.last_name)) {
    return sendJson(res, 400, { success: false, message: 'Last name must contain only English letters', data: null });
  }
  if (b.date_of_birth !== undefined && b.date_of_birth !== null && String(b.date_of_birth).trim() !== '' && !isValidDateOnly(b.date_of_birth)) {
    return sendJson(res, 400, { success: false, message: 'date_of_birth must be a valid date (YYYY-MM-DD)', data: null });
  }
  if (b.father_name !== undefined && b.father_name !== null && String(b.father_name).trim() !== '' && !isEnglishName(b.father_name)) {
    return sendJson(res, 400, { success: false, message: 'Father name must contain only English letters', data: null });
  }
  if (b.mother_name !== undefined && b.mother_name !== null && String(b.mother_name).trim() !== '' && !isEnglishName(b.mother_name)) {
    return sendJson(res, 400, { success: false, message: 'Mother name must contain only English letters', data: null });
  }
  next();
}

