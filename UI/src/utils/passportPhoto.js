/**
 * Passport-size photo helpers.
 *
 * Spec (Indian passport / school ID style):
 * - Aspect 35 × 45 mm (width × height) → 7:9
 * - Processed pixel size: 350 × 450
 * - Accepted raw input: JPEG / PNG / WebP, max 5 MB
 * - Output: JPEG under 1 MB (typically ~30–80 KB)
 */

export const PASSPORT_PHOTO = {
  widthMm: 35,
  heightMm: 45,
  widthPx: 350,
  heightPx: 450,
  /** Max size for the raw file the user picks (before processing). */
  maxUploadBytes: 5 * 1024 * 1024,
  /** Hard cap for the processed file sent to the API. */
  maxProcessedBytes: 1 * 1024 * 1024,
  accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

/** PDF draw size in points (≈ 35×45 mm). */
export const PASSPORT_PHOTO_PDF = {
  widthPt: 68,
  heightPt: 87,
  borderPt: 0.8,
};

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not encode photo'));
    reader.readAsDataURL(blob);
  });
}

function cropAndScaleToCanvas(img, targetW, targetH) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw new Error('Invalid image dimensions');

  const targetAspect = targetW / targetH;
  const srcAspect = srcW / srcH;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcAspect > targetAspect) {
    sw = Math.round(srcH * targetAspect);
    sx = Math.round((srcW - sw) / 2);
  } else if (srcAspect < targetAspect) {
    sh = Math.round(srcW / targetAspect);
    sy = Math.round((srcH - sh) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not encode photo'));
        else resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Validate and process an uploaded photo into a passport-sized JPEG File (≤ 1 MB).
 * @param {File} file
 * @returns {Promise<{
 *   file: File,
 *   previewUrl: string,
 *   width: number,
 *   height: number,
 *   wasResized: boolean,
 *   originalWidth: number,
 *   originalHeight: number,
 *   originalBytes: number,
 *   processedBytes: number,
 * }>}
 */
export async function processPassportPhoto(file) {
  if (!file) throw new Error('Please choose a photo');
  const type = String(file.type || '').toLowerCase();
  if (type && !PASSPORT_PHOTO.mimeTypes.includes(type)) {
    throw new Error('Use a JPEG, PNG, or WebP image');
  }
  if (file.size > PASSPORT_PHOTO.maxUploadBytes) {
    throw new Error('Photo must be 5 MB or smaller');
  }

  const img = await loadImageFromBlob(file);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  const { widthPx, heightPx, maxProcessedBytes } = PASSPORT_PHOTO;

  const wasResized =
    originalWidth !== widthPx ||
    originalHeight !== heightPx ||
    Math.abs(originalWidth / originalHeight - widthPx / heightPx) > 0.02 ||
    file.size > maxProcessedBytes;

  const canvas = cropAndScaleToCanvas(img, widthPx, heightPx);

  let quality = 0.88;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > maxProcessedBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToJpegBlob(canvas, quality);
  }
  if (blob.size > maxProcessedBytes) {
    throw new Error('Could not compress photo under 1 MB');
  }

  const outName = String(file.name || 'passport')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);
  const outFile = new File([blob], `${outName || 'passport'}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  return {
    file: outFile,
    previewUrl: URL.createObjectURL(outFile),
    dataUrl: await blobToDataUrl(blob),
    width: widthPx,
    height: heightPx,
    wasResized,
    originalWidth,
    originalHeight,
    originalBytes: file.size,
    processedBytes: outFile.size,
  };
}
