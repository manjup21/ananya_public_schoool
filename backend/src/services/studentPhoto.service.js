import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db/db.js';
import { env } from '../utils/env.js';
import { MESSAGES } from '../constants/messages.js';

export const STUDENT_PHOTO_MAX_BYTES = 1 * 1024 * 1024;
export const STUDENT_PHOTO_MIME_TO_EXT = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

function studentsPhotoDir() {
  return path.join(env.uploadDir, 'students');
}

function sanitizeRollForFilename(rollNumber) {
  const raw = String(rollNumber ?? '').trim();
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return safe || null;
}

export function absolutePhotoPath(relativePath) {
  if (!relativePath) return null;
  const cleaned = String(relativePath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleaned.includes('..')) return null;
  return path.join(env.uploadDir, cleaned);
}

async function ensureStudentsDir() {
  await fs.mkdir(studentsPhotoDir(), { recursive: true });
}

async function unlinkQuiet(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

async function getStudentPhotoRow(studentId) {
  const result = await pool.query(
    `SELECT id, roll_number, photo_path
     FROM students
     WHERE id = $1::uuid AND is_deleted = FALSE`,
    [studentId]
  );
  return result.rows?.[0] ?? null;
}

async function setPhotoPath(studentId, photoPath) {
  await pool.query(
    `UPDATE students
     SET photo_path = $2,
         updated_at = NOW()
     WHERE id = $1::uuid AND is_deleted = FALSE`,
    [studentId, photoPath]
  );
}

/**
 * Save/replace passport photo for a student. `file` is a multer memory file.
 */
export async function uploadStudentPhoto(studentId, file) {
  if (!file?.buffer?.length) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.student.photoRequired,
      data: null,
    };
  }

  const mime = String(file.mimetype || '').toLowerCase();
  const ext = STUDENT_PHOTO_MIME_TO_EXT[mime];
  if (!ext) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.student.photoInvalidType,
      data: null,
    };
  }

  if (file.size > STUDENT_PHOTO_MAX_BYTES) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.student.photoTooLarge,
      data: null,
    };
  }

  const student = await getStudentPhotoRow(studentId);
  if (!student) {
    return {
      statusCode: 404,
      success: false,
      message: MESSAGES.student.notFound,
      data: null,
    };
  }

  const rollSafe = sanitizeRollForFilename(student.roll_number);
  if (!rollSafe) {
    return {
      statusCode: 400,
      success: false,
      message: 'Student roll number is invalid for photo filename',
      data: null,
    };
  }

  await ensureStudentsDir();
  const relativePath = `students/${rollSafe}${ext}`;
  const absPath = absolutePhotoPath(relativePath);

  const previousAbs = absolutePhotoPath(student.photo_path);
  if (previousAbs && previousAbs !== absPath) {
    await unlinkQuiet(previousAbs);
  }

  await fs.writeFile(absPath, file.buffer);
  await setPhotoPath(studentId, relativePath);

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.student.photoUploaded,
    data: { id: studentId, photo_path: relativePath },
  };
}

export async function deleteStudentPhoto(studentId) {
  const student = await getStudentPhotoRow(studentId);
  if (!student) {
    return {
      statusCode: 404,
      success: false,
      message: MESSAGES.student.notFound,
      data: null,
    };
  }

  const absPath = absolutePhotoPath(student.photo_path);
  if (absPath) await unlinkQuiet(absPath);
  await setPhotoPath(studentId, null);

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.student.photoDeleted,
    data: null,
  };
}

/**
 * Resolve photo file for streaming. Returns { absPath, mime } or an error result.
 */
export async function resolveStudentPhotoFile(studentId) {
  const student = await getStudentPhotoRow(studentId);
  if (!student) {
    return {
      statusCode: 404,
      success: false,
      message: MESSAGES.student.notFound,
      data: null,
    };
  }

  if (!student.photo_path) {
    return {
      statusCode: 404,
      success: false,
      message: MESSAGES.student.photoNotFound,
      data: null,
    };
  }

  const absPath = absolutePhotoPath(student.photo_path);
  if (!absPath) {
    return {
      statusCode: 404,
      success: false,
      message: MESSAGES.student.photoNotFound,
      data: null,
    };
  }

  try {
    await fs.access(absPath);
  } catch {
    return {
      statusCode: 404,
      success: false,
      message: MESSAGES.student.photoNotFound,
      data: null,
    };
  }

  const ext = path.extname(absPath).toLowerCase();
  const mimeByExt = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };

  return {
    statusCode: 200,
    success: true,
    message: 'OK',
    data: { absPath, mime: mimeByExt[ext] || 'application/octet-stream' },
  };
}

/**
 * When roll number changes, rename photo file on disk and update photo_path.
 */
export async function renameStudentPhotoForRollChange(studentId, oldRoll, newRoll, currentPhotoPath) {
  if (!currentPhotoPath) return currentPhotoPath;

  const oldSafe = sanitizeRollForFilename(oldRoll);
  const newSafe = sanitizeRollForFilename(newRoll);
  if (!oldSafe || !newSafe || oldSafe === newSafe) return currentPhotoPath;

  const oldExt = path.extname(String(currentPhotoPath));
  const newRelative = `students/${newSafe}${oldExt || '.jpg'}`;
  const oldAbs = absolutePhotoPath(currentPhotoPath);
  const newAbs = absolutePhotoPath(newRelative);
  if (!oldAbs || !newAbs || oldAbs === newAbs) return currentPhotoPath;

  await ensureStudentsDir();
  try {
    await fs.rename(oldAbs, newAbs);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      // File missing — clear stale path
      await setPhotoPath(studentId, null);
      return null;
    }
    throw err;
  }

  await setPhotoPath(studentId, newRelative);
  return newRelative;
}
