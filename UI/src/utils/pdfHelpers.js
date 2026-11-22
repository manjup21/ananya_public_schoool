export function blankStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Returns a data URL for jsPDF `addImage`, or null if the image can't be fetched. */
export async function loadImageAsDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

export function placeFromAddress(address) {
  const parts = blankStr(address).split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function drawDoubleBorder(doc, pageWidth, pageHeight) {
  const outer = 18;
  const inner = 24;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(1.4);
  doc.rect(outer, outer, pageWidth - outer * 2, pageHeight - outer * 2);
  doc.setLineWidth(0.5);
  doc.rect(inner, inner, pageWidth - inner * 2, pageHeight - inner * 2);
}

/** Word-wrapped paragraph where each segment `{ text, bold }` keeps its own weight. Returns the next y. */
export function drawRichParagraph(doc, segments, { x, y, maxWidth, fontSize, lineGap, color = [25, 25, 25] }) {
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);

  let cursorX = x;
  let cursorY = y;

  for (const seg of segments) {
    const words = String(seg.text ?? '').split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      const w = (doc.getStringUnitWidth(word) * fontSize) / doc.internal.scaleFactor;
      if (cursorX > x && cursorX + w > x + maxWidth && !/^\s+$/.test(word)) {
        cursorY += lineGap;
        cursorX = x;
      }
      if (cursorX === x && /^\s+$/.test(word)) continue;
      doc.text(word, cursorX, cursorY);
      cursorX += w;
    }
  }

  return cursorY + lineGap;
}
