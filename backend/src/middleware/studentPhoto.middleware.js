import multer from 'multer';
import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import {
  STUDENT_PHOTO_MAX_BYTES,
  STUDENT_PHOTO_MIME_TO_EXT,
} from '../services/studentPhoto.service.js';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: STUDENT_PHOTO_MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const mime = String(file.mimetype || '').toLowerCase();
    if (!STUDENT_PHOTO_MIME_TO_EXT[mime]) {
      const err = new Error(MESSAGES.student.photoInvalidType);
      err.code = 'INVALID_PHOTO_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

export function uploadStudentPhotoMiddleware(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendJson(res, 400, {
          success: false,
          message: MESSAGES.student.photoTooLarge,
          data: null,
        });
      }
      return sendJson(res, 400, {
        success: false,
        message: err.message || 'Invalid photo upload',
        data: null,
      });
    }

    if (err?.code === 'INVALID_PHOTO_TYPE') {
      return sendJson(res, 400, {
        success: false,
        message: MESSAGES.student.photoInvalidType,
        data: null,
      });
    }

    return sendJson(res, 400, {
      success: false,
      message: err?.message || 'Invalid photo upload',
      data: null,
    });
  });
}
