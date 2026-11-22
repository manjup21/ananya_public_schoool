function normStr(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export const PART_B_GRADE_MAX_LEN = 50;

/** Excel / UI header for a Part B subject column. */
export function partBColumnHeader(subjectName) {
  return `PB | ${String(subjectName ?? '').trim()}`;
}

/**
 * If header is `PB | {name}` (case-insensitive), return the subject name; else null.
 */
function parsePartBHeader(header) {
  const s = String(header ?? '').trim();
  const m = /^PB\s*\|\s*(.+)$/i.exec(s);
  if (!m) return null;
  return m[1].trim() || null;
}

function normalizeSubjectHeader(header) {
  return normStr(header).replace(/[^a-z0-9 ]/g, '');
}

export function normalizeRoll(roll) {
  return String(roll ?? '').trim();
}

export function isPartBSubject(subject) {
  return Boolean(subject?.is_part_b);
}

export function partitionExamSubjects(subjects) {
  const list = Array.isArray(subjects) ? subjects : [];
  return {
    partA: list.filter((s) => !isPartBSubject(s)),
    partB: list.filter((s) => isPartBSubject(s)),
  };
}

/**
 * Parse a marks cell value into a normalized representation.
 * - '' => missing (allowed for partial save)
 * - 'AB' (any case) => absent
 * - number string => number
 */
export function parseMarkValue(raw) {
  if (raw == null) return { kind: 'missing', value: '' };
  if (typeof raw === 'number' && Number.isFinite(raw)) return { kind: 'number', value: raw };
  if (typeof raw === 'object' && raw !== null && 'text' in raw) {
    return parseMarkValue(raw.text);
  }
  if (typeof raw === 'object' && raw !== null && 'result' in raw) {
    return parseMarkValue(raw.result);
  }
  const s = String(raw).trim();
  if (!s) return { kind: 'missing', value: '' };
  if (s.toLowerCase() === 'ab') return { kind: 'absent', value: 'AB' };
  // allow "42", "42.5"
  const n = Number(s);
  if (Number.isFinite(n)) return { kind: 'number', value: n };
  return { kind: 'invalid', value: s };
}

/** Normalize a Part B free-text grade cell (max 50 chars). */
export function parsePartBGrade(raw) {
  if (raw == null) return { kind: 'missing', value: '' };
  if (typeof raw === 'object' && raw !== null && 'text' in raw) {
    return parsePartBGrade(raw.text);
  }
  if (typeof raw === 'object' && raw !== null && 'result' in raw) {
    return parsePartBGrade(raw.result);
  }
  const s = String(raw).trim();
  if (!s) return { kind: 'missing', value: '' };
  if (s.length > PART_B_GRADE_MAX_LEN) return { kind: 'invalid', value: s };
  return { kind: 'grade', value: s };
}

/**
 * Validate a parsed mark for a subject.
 * Empty/missing is allowed (partial entry); only junk / over-max is invalid.
 */
export function validateMarkValue(parsed, subject) {
  if (!subject) return { valid: false, reason: 'Unknown subject' };
  if (parsed.kind === 'missing') return { valid: true, reason: null };
  if (parsed.kind === 'invalid') return { valid: false, reason: 'Invalid' };
  if (parsed.kind === 'absent') return { valid: true, reason: null };
  const n = parsed.value;
  const max = Number(subject.max_marks);
  if (!Number.isFinite(max)) return { valid: false, reason: 'Invalid subject max' };
  // Allow negative marks for exams like JEE/NEET.
  if (n > max) return { valid: false, reason: `Must be ≤ ${max}` };
  return { valid: true, reason: null };
}

export function validatePartBGrade(parsed) {
  if (parsed.kind === 'missing') return { valid: true, reason: null };
  if (parsed.kind === 'invalid') {
    return { valid: false, reason: 'Invalid grade' };
  }
  return { valid: true, reason: null };
}

function subjectHasPassingMarks(subject) {
  if (subject == null) return false;
  const v = subject.passing_marks;
  if (v === undefined || v === null || v === '') return false;
  return Number.isFinite(Number(v));
}

function examHasPassingCriteria(subjects) {
  return (subjects ?? []).filter((s) => !isPartBSubject(s)).some(subjectHasPassingMarks);
}

export function formatPassLabel(subject) {
  if (!subjectHasPassingMarks(subject)) return 'Pass —';
  return `Pass ${subject.passing_marks}`;
}

/**
 * Compute per-student status + summary from rows/subjects.
 *
 * Row shape:
 * {
 *   roll_number, student_name,
 *   marksBySubjectId: { [subjectId]: number | 'AB' | '' },
 *   gradesBySubjectId?: { [subjectId]: string }
 * }
 *
 * Pass/fail/total use Part A subjects only. Part B grades > 50 chars count as invalid.
 *
 * Failed/passed summary counts are null (UI shows NA) when no Part A subject has passing marks.
 */
export function computeResults({ rows, subjects }) {
  let invalidCells = 0;
  let missingCells = 0;
  let absentStudents = 0;
  let passed = 0;
  let failed = 0;
  let incompleteStudents = 0;

  const { partA, partB } = partitionExamSubjects(subjects);
  const hasPassCriteria = examHasPassingCriteria(partA);

  const enriched = (rows ?? []).map((r) => {
    const marksBySubjectId = r.marksBySubjectId ?? {};
    const gradesBySubjectId = r.gradesBySubjectId ?? {};
    let hasInvalid = false;
    let hasMissing = false;
    let hasAbsent = false;
    let hasFail = false;
    let total = 0;

    for (const s of partA) {
      const v = marksBySubjectId[s.id];
      const parsed = parseMarkValue(v);
      if (parsed.kind === 'missing') {
        hasMissing = true;
        missingCells += 1;
        continue;
      }
      const val = validateMarkValue(parsed, s);
      if (!val.valid) {
        hasInvalid = true;
        invalidCells += 1;
      } else if (parsed.kind === 'absent') {
        hasAbsent = true;
        if (subjectHasPassingMarks(s)) hasFail = true;
      } else if (parsed.kind === 'number') {
        total += parsed.value;
        if (subjectHasPassingMarks(s)) {
          const pass = Number(s.passing_marks);
          if (parsed.value < pass) hasFail = true;
        }
      }
    }

    for (const s of partB) {
      const parsed = parsePartBGrade(gradesBySubjectId[s.id]);
      const val = validatePartBGrade(parsed);
      if (!val.valid) {
        hasInvalid = true;
        invalidCells += 1;
      }
    }

    let status = 'incomplete';
    if (hasInvalid) {
      status = 'invalid';
    } else if (!hasMissing) {
      if (hasAbsent) status = 'absent';
      else if (hasPassCriteria && hasFail) status = 'failed';
      else status = 'passed';
    }

    if (status === 'absent') absentStudents += 1;
    else if (status === 'passed') passed += 1;
    else if (status === 'failed') failed += 1;
    else if (status === 'incomplete') incompleteStudents += 1;

    return {
      ...r,
      total,
      status,
      _flags: { hasInvalid, hasMissing, hasAbsent, hasFail },
    };
  });

  const rollCmp = (a, b) =>
    String(a.roll_number ?? '').localeCompare(String(b.roll_number ?? ''), undefined, { numeric: true });

  const statusOrder = (s) => {
    if (s === 'passed') return 0;
    if (s === 'failed') return 1;
    if (s === 'absent') return 2;
    if (s === 'incomplete') return 3;
    return 4; // invalid
  };

  const ranked = [...enriched].sort((a, b) => {
    const sa = statusOrder(a.status);
    const sb = statusOrder(b.status);
    if (sa !== sb) return sa - sb;
    if (a.status === 'invalid' || a.status === 'incomplete') {
      if (b.status === a.status) return rollCmp(a, b);
    }
    if (b.total !== a.total) return b.total - a.total;
    return rollCmp(a, b);
  });

  // Rank only fully complete passed/failed rows
  let currentRank = 0;
  let lastTotal = null;
  let lastStatus = null;
  for (const row of ranked) {
    if (row.status === 'passed' || row.status === 'failed') {
      if (lastTotal === null || row.total !== lastTotal || row.status !== lastStatus) {
        currentRank += 1;
        lastTotal = row.total;
        lastStatus = row.status;
      }
      row.rank = currentRank;
    } else {
      row.rank = null;
    }
  }

  return {
    rows: enriched,
    rankedRows: ranked,
    summary: {
      invalidCells,
      missingCells,
      incompleteStudents,
      absentStudents,
      hasPassCriteria,
      passed: hasPassCriteria ? passed : null,
      failed: hasPassCriteria ? failed : null,
      totalStudents: enriched.length,
    },
  };
}

export function buildEmptyMarksRows({ students, subjects }) {
  const { partA, partB } = partitionExamSubjects(subjects);
  return (students ?? []).map((s) => ({
    student_id: s.id ?? null,
    roll_number: s.roll_number,
    student_name: s.student_name,
    marksBySubjectId: Object.fromEntries(partA.map((x) => [x.id, ''])),
    gradesBySubjectId: Object.fromEntries(partB.map((x) => [x.id, ''])),
  }));
}

/** Resolve an Excel header to a subject id (Part A name or `PB | name`). */
export function subjectIdFromExcelHeader(header, subjects) {
  const list = Array.isArray(subjects) ? subjects : [];
  const pbName = parsePartBHeader(header);
  if (pbName) {
    const key = normalizeSubjectHeader(pbName);
    const hit = list.find((s) => isPartBSubject(s) && normalizeSubjectHeader(s.name) === key);
    return hit?.id ?? null;
  }
  const key = normalizeSubjectHeader(header);
  const hit = list.find((s) => !isPartBSubject(s) && normalizeSubjectHeader(s.name) === key);
  return hit?.id ?? null;
}
