import { todayDateOnly } from '../../utils/dateOnly';
import { blankStr as blank } from '../../utils/pdfHelpers';

function defaultAcademicYear(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based; academic year typically Jun–May
  if (m >= 5) return `${y}-${String(y + 1).slice(-2)}`;
  return `${y - 1}-${String(y).slice(-2)}`;
}

function splitNationalityReligion(combined) {
  const raw = blank(combined);
  if (!raw) return { nationality: 'Indian', religion: '' };
  const parts = raw.split(/[\s,/|-]+/).filter(Boolean);
  if (parts.length === 1) {
    if (/indian/i.test(parts[0])) return { nationality: 'Indian', religion: '' };
    return { nationality: 'Indian', religion: parts[0] };
  }
  if (/indian/i.test(parts[0])) {
    return { nationality: 'Indian', religion: parts.slice(1).join(' ') };
  }
  return { nationality: parts[0], religion: parts.slice(1).join(' ') };
}

export function createEmptyTcExtras() {
  return {
    tcNo: '',
    admissionNo: '',
    academicYear: defaultAcademicYear(),
    nationality: 'Indian',
    religion: '',
    caste: '',
    classLeaving: '',
    examinationAttended: '',
    registerNo: '',
    examMonth: '',
    examYear: '',
    examResult: '',
    qualifiedNextClass: 'YES',
    dateOfApplication: todayDateOnly(),
    dateOfIssue: todayDateOnly(),
    conduct: 'SATISFACTORY',
    photoDataUrl: null,
  };
}

export function createEmptyTcManualStudent() {
  return {
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    father_name: '',
    mother_name: '',
    roll_number: '',
  };
}

export function prefillTcExtrasFromStudent(student, className = '') {
  const { nationality, religion } = splitNationalityReligion(student?.nationality_religion);
  return {
    ...createEmptyTcExtras(),
    admissionNo: blank(student?.enrolment_number) || blank(student?.roll_number),
    nationality: nationality || 'Indian',
    religion: religion || '',
    caste: blank(student?.caste),
    classLeaving: blank(className),
  };
}

export function buildTransferCertificateRecord({
  student,
  className = '',
  extras = {},
  manualMode = false,
  manualStudent = null,
}) {
  const src = manualMode ? manualStudent : student;
  if (!src) throw new Error('Student is required');

  const e = { ...createEmptyTcExtras(), ...extras };
  const fullName = [blank(src.first_name), blank(src.last_name)].filter(Boolean).join(' ');

  return {
    academicYear: blank(e.academicYear) || defaultAcademicYear(),
    tcNo: blank(e.tcNo),
    admissionNo: blank(e.admissionNo) || blank(src.enrolment_number) || blank(src.roll_number),
    pupilName: fullName,
    fatherName: blank(src.father_name),
    motherName: blank(src.mother_name),
    dateOfBirth: blank(src.date_of_birth),
    nationality: blank(e.nationality) || 'Indian',
    religion: blank(e.religion),
    caste: blank(e.caste),
    classLeaving: blank(e.classLeaving) || blank(className),
    examinationAttended: blank(e.examinationAttended),
    registerNo: blank(e.registerNo),
    examMonth: blank(e.examMonth),
    examYear: blank(e.examYear),
    examResult: blank(e.examResult),
    qualifiedNextClass: blank(e.qualifiedNextClass) || 'YES',
    dateOfApplication: blank(e.dateOfApplication),
    dateOfIssue: blank(e.dateOfIssue),
    conduct: blank(e.conduct) || 'SATISFACTORY',
    photoDataUrl: e.photoDataUrl || null,
    rollNumber: blank(src.roll_number),
  };
}
