/** Shared administrator signature for admit cards and report PDFs. */

import { loadImageAsDataUrl } from './pdfHelpers';

/** Set to '/admin-signature.png' once the school's signature image is added to public/. */
const ADMIN_SIGNATURE_URL = '';
const ADMINISTRATOR_NAME = '';
const ADMINISTRATOR_TITLE = 'ADMINISTRATOR';

let cachedSignaturePromise = null;

export function preloadAdminSignature() {
  if (!cachedSignaturePromise) {
    cachedSignaturePromise = ADMIN_SIGNATURE_URL
      ? loadImageAsDataUrl(ADMIN_SIGNATURE_URL)
      : Promise.resolve(null);
  }
  return cachedSignaturePromise;
}

/**
 * Draw signature image centered above name + ADMINISTRATOR title.
 * @returns {{ bottom: number }} baseline y under the title text
 */
export function drawAdministratorSignature(doc, {
  centerX,
  topY,
  imageDataUrl,
  imageWidth = 88,
  imageHeight = 40,
  name = ADMINISTRATOR_NAME,
  title = ADMINISTRATOR_TITLE,
  nameFontSize = 9.5,
  titleFontSize = 8.5,
}) {
  let y = topY;
  if (imageDataUrl) {
    try {
      const format = String(imageDataUrl).includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(imageDataUrl, format, centerX - imageWidth / 2, y, imageWidth, imageHeight, undefined, 'FAST');
    } catch {
      /* ignore broken asset */
    }
    y += imageHeight + 2;
  } else {
    doc.setDrawColor(40);
    doc.setLineWidth(0.55);
    doc.line(centerX - imageWidth / 2, y + imageHeight - 4, centerX + imageWidth / 2, y + imageHeight - 4);
    y += imageHeight + 2;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(nameFontSize);
  doc.setTextColor(10);
  doc.text(name, centerX, y + 10, { align: 'center' });
  doc.setFontSize(titleFontSize);
  doc.text(title, centerX, y + 22, { align: 'center' });
  return { bottom: y + 22 };
}
