const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_ORDINALS = [
  '',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
  'Thirteenth',
  'Fourteenth',
  'Fifteenth',
  'Sixteenth',
  'Seventeenth',
  'Eighteenth',
  'Nineteenth',
  'Twentieth',
  'Twenty First',
  'Twenty Second',
  'Twenty Third',
  'Twenty Fourth',
  'Twenty Fifth',
  'Twenty Sixth',
  'Twenty Seventh',
  'Twenty Eighth',
  'Twenty Ninth',
  'Thirtieth',
  'Thirty First',
];

function numberToWords(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return '';
  if (num === 0) return 'Zero';
  if (num < 20) return ONES[num];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return rest ? `${ONES[h]} Hundred ${numberToWords(rest)}` : `${ONES[h]} Hundred`;
  }
  if (num < 10000) {
    const th = Math.floor(num / 1000);
    const rest = num % 1000;
    return rest ? `${ONES[th]} Thousand ${numberToWords(rest)}` : `${ONES[th]} Thousand`;
  }
  // 10000–9999 handled above; years like 2008
  if (num < 100000) {
    const th = Math.floor(num / 1000);
    const rest = num % 1000;
    const thWords = th < 20 ? ONES[th] : numberToWords(th);
    return rest ? `${thWords} Thousand ${numberToWords(rest)}` : `${thWords} Thousand`;
  }
  return String(num);
}

function parseDateInput(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * TC-style DOB in words, e.g. "Seventeenth -June -Two Thousand Eight".
 */
export function formatDateOfBirthInWordsTc(value) {
  const d = parseDateInput(value);
  if (!d) return '';
  const day = DAY_ORDINALS[d.getDate()] || String(d.getDate());
  const month = MONTHS[d.getMonth()];
  const year = numberToWords(d.getFullYear());
  return `${day} - ${month} - ${year}`;
}

export function formatDobNumeric(value) {
  const d = parseDateInput(value);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}
