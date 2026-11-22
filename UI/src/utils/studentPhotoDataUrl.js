import { api } from '../services/api';
import { mapPool } from './fileExport';
import { blobToDataUrl } from './pdfHelpers';

/**
 * Fetch a student's passport photo as a data URL for PDF embeds.
 * Returns null when missing or on error.
 */
export async function fetchStudentPhotoDataUrl(studentId) {
  if (!studentId) return null;
  try {
    const res = await api.get(`/students/${studentId}/photo`, { responseType: 'blob' });
    const contentType = String(res.headers?.['content-type'] || '');
    if (contentType.includes('application/json')) return null;
    const blob = res.data;
    if (!blob || !(blob instanceof Blob) || blob.size === 0) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Load photos for many students (concurrency-limited).
 * @returns {Promise<Record<string, string>>} studentId → dataUrl
 */
export async function fetchStudentPhotosMap(students, concurrency = 6) {
  const list = (Array.isArray(students) ? students : []).filter((s) => s?.id && s?.photo_path);
  const photos = {};
  await mapPool(
    list,
    concurrency,
    async (student) => {
      const dataUrl = await fetchStudentPhotoDataUrl(student.id);
      if (dataUrl) photos[String(student.id)] = dataUrl;
    },
    { yieldToUi: false }
  );
  return photos;
}
