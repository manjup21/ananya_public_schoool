/** Shared marks ranking logic (mirrors UI marksValidation.computeResults). */

function parseMarkValue(raw) {
  if (raw == null) return { kind: 'missing', value: '' };
  if (typeof raw === 'number' && Number.isFinite(raw)) return { kind: 'number', value: raw };
  const s = String(raw).trim();
  if (!s) return { kind: 'missing', value: '' };
  if (s.toLowerCase() === 'ab') return { kind: 'absent', value: 'AB' };
  const n = Number(s);
  if (Number.isFinite(n)) return { kind: 'number', value: n };
  return { kind: 'invalid', value: s };
}

function validateMarkValue(parsed, subject) {
  if (!subject) return { valid: false, reason: 'Unknown subject' };
  if (parsed.kind === 'missing') return { valid: true, reason: null };
  if (parsed.kind === 'invalid') return { valid: false, reason: 'Invalid' };
  if (parsed.kind === 'absent') return { valid: true, reason: null };
  const n = parsed.value;
  const max = Number(subject.max_marks);
  if (!Number.isFinite(max)) return { valid: false, reason: 'Invalid subject max' };
  if (n > max) return { valid: false, reason: `Must be ≤ ${max}` };
  return { valid: true, reason: null };
}

export function computeResults({ rows, subjects }) {
  let invalidCells = 0;
  let absentStudents = 0;
  let passed = 0;
  let failed = 0;

  const enriched = (rows ?? []).map((r) => {
    const marksBySubjectId = r.marksBySubjectId ?? {};
    let hasInvalid = false;
    let hasMissing = false;
    let hasAbsent = false;
    let hasFail = false;
    let total = 0;

    for (const s of subjects ?? []) {
      const v = marksBySubjectId[s.id];
      const parsed = parseMarkValue(v);
      if (parsed.kind === 'missing') {
        hasMissing = true;
        continue;
      }
      const val = validateMarkValue(parsed, s);
      if (!val.valid) {
        hasInvalid = true;
        invalidCells += 1;
      } else if (parsed.kind === 'absent') {
        hasAbsent = true;
        hasFail = true;
      } else if (parsed.kind === 'number') {
        total += parsed.value;
        const pass = Number(s.passing_marks);
        if (Number.isFinite(pass) && parsed.value < pass) hasFail = true;
      }
    }

    let status = 'incomplete';
    if (hasInvalid) {
      status = 'invalid';
    } else if (!hasMissing) {
      if (hasAbsent) status = 'absent';
      else if (hasFail) status = 'failed';
      else status = 'passed';
    }

    if (status === 'absent') absentStudents += 1;
    else if (status === 'passed') passed += 1;
    else if (status === 'failed') failed += 1;

    return {
      ...r,
      total,
      status,
    };
  });

  const rollCmp = (a, b) =>
    String(a.roll_number ?? '').localeCompare(String(b.roll_number ?? ''), undefined, { numeric: true });

  const statusOrder = (s) => {
    if (s === 'passed') return 0;
    if (s === 'failed') return 1;
    if (s === 'absent') return 2;
    if (s === 'incomplete') return 3;
    return 4;
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

  return { rankedRows: ranked };
}
