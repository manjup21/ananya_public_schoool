/**
 * Browser-side image downscale for lighter PDF embeds.
 * Resizes to print-useful resolution; keeps high quality so logos/photos stay clear.
 */

const optimizeCache = new Map();

function cacheKey(dataUrl, opts) {
  return [
    opts.maxWidth ?? '',
    opts.maxHeight ?? '',
    opts.mime ?? '',
    opts.quality ?? '',
    opts.flattenWhite ? '1' : '0',
    String(dataUrl).length,
    String(dataUrl).slice(0, 64),
    String(dataUrl).slice(-48),
  ].join('|');
}

/**
 * @param {string} dataUrl
 * @param {{ maxWidth?: number, maxHeight?: number, mime?: string, quality?: number, flattenWhite?: boolean }} [opts]
 * @returns {Promise<string|null>}
 */
export async function optimizeImageDataUrl(dataUrl, opts = {}) {
  if (!dataUrl || typeof document === 'undefined') return dataUrl || null;

  const maxWidth = opts.maxWidth ?? 1200;
  const maxHeight = opts.maxHeight ?? 1600;
  const mime = opts.mime ?? 'image/jpeg';
  const quality = opts.quality ?? 0.9;
  const flattenWhite = Boolean(opts.flattenWhite);
  const key = cacheKey(dataUrl, { maxWidth, maxHeight, mime, quality, flattenWhite });
  if (optimizeCache.has(key)) return optimizeCache.get(key);

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });

    const srcW = img.naturalWidth || img.width || 0;
    const srcH = img.naturalHeight || img.height || 0;
    if (!srcW || !srcH) return dataUrl;

    const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
    // Already within print size — skip re-encode to preserve original clarity
    if (scale >= 0.98 && mime === 'image/png' && !flattenWhite) {
      optimizeCache.set(key, dataUrl);
      return dataUrl;
    }

    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: mime === 'image/png' && !flattenWhite });
    if (!ctx) return dataUrl;

    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, w, h);
    if (flattenWhite || mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    const out =
      mime === 'image/jpeg'
        ? canvas.toDataURL('image/jpeg', quality)
        : canvas.toDataURL('image/png');

    optimizeCache.set(key, out);
    return out;
  } catch {
    return dataUrl;
  }
}

/**
 * Print-oriented caps (~2.5–3× on-page pt size).
 * Size savings come from not embedding oversized sources, not from heavy JPEG crush.
 */
export const HALL_TICKET_IMAGE_PRESETS = Object.freeze({
  logo: { maxWidth: 220, maxHeight: 220, mime: 'image/png', flattenWhite: false },
  signature: { maxWidth: 280, maxHeight: 160, mime: 'image/png', flattenWhite: false },
  photo: { maxWidth: 320, maxHeight: 400, mime: 'image/jpeg', quality: 0.9, flattenWhite: true },
});

export const REPORT_IMAGE_PRESETS = Object.freeze({
  signature: { maxWidth: 280, maxHeight: 160, mime: 'image/png', flattenWhite: false },
});
