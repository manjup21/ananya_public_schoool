export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function sanitizeFilePart(value, maxLength = 80) {
  return String(value ?? '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, maxLength);
}

/** Accepts a Blob, or raw bytes (ArrayBuffer / typed array) plus a MIME type. */
export function downloadBlob(data, filename, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function yieldToUi() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Runs `fn` over `items` with bounded concurrency. By default yields to the UI every `concurrency`
 * items; yielding waits for an animation frame, which stalls while the tab is hidden.
 */
export async function mapPool(items, concurrency, fn, { yieldToUi: shouldYield = true } = {}) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(concurrency, list.length || 1));
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next;
      next += 1;
      out[i] = await fn(list[i], i);
      if (shouldYield && i % concurrency === concurrency - 1) await yieldToUi();
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

function cellDisplayLength(value) {
  if (value == null) return 0;
  if (typeof value === 'object' && 'text' in value) return String(value.text).length;
  return String(value).length;
}

/** Set ExcelJS column widths from content (Excel character-width units, capped). */
export function autoFitColumns(worksheet, columnCount, { min = 10, max = 50 } = {}) {
  const widths = Array.from({ length: columnCount }, () => min);
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber < 1 || colNumber > columnCount) return;
      const len = cellDisplayLength(cell.value);
      const i = colNumber - 1;
      if (len > widths[i]) widths[i] = len;
    });
  });
  for (let i = 0; i < columnCount; i++) {
    worksheet.getColumn(i + 1).width = Math.min(Math.max(widths[i] + 2, min), max);
  }
}
