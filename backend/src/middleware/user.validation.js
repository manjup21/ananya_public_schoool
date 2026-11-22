import { sendJson } from '../utils/apiResponse.js';
import { UUID_REGEX } from '../utils/validators.js';

const ALLOWED_ROLES = new Set(['admin', 'lecturer']);

function missingField(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function validateOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') return `${fieldName} must be a boolean`;
  return null;
}

export function validateCreateUser(req, res, next) {
  const { name, email, password, role } = req.body ?? {};
  const errors = [];
  if (missingField(name)) errors.push('name is required');
  if (missingField(email)) errors.push('email is required');
  if (missingField(password)) errors.push('password is required');
  if (missingField(role)) errors.push('role is required');
  if (!missingField(role) && !ALLOWED_ROLES.has(String(role).trim())) {
    errors.push('role must be admin or lecturer');
  }
  if (errors.length) {
    return sendJson(res, 400, {
      success: false,
      message: errors.join('; '),
      data: null,
    });
  }
  next();
}

export function validateUpdateUser(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, {
      success: false,
      message: 'Valid user id (UUID) is required',
      data: null,
    });
  }
  const {
    name,
    email,
    password,
    role,
    can_manage_fees,
    is_super_admin,
    is_admin,
  } = req.body ?? {};
  const hasAny =
    name !== undefined ||
    email !== undefined ||
    password !== undefined ||
    role !== undefined ||
    can_manage_fees !== undefined ||
    is_super_admin !== undefined ||
    is_admin !== undefined;
  if (!hasAny) {
    return sendJson(res, 400, {
      success: false,
      message:
        'At least one of name, email, password, role, can_manage_fees, is_super_admin, or is_admin is required',
      data: null,
    });
  }
  if (role !== undefined && role !== null && String(role).trim() !== '') {
    if (!ALLOWED_ROLES.has(String(role).trim())) {
      return sendJson(res, 400, {
        success: false,
        message: 'role must be admin or lecturer',
        data: null,
      });
    }
  }
  for (const [field, value] of [
    ['can_manage_fees', can_manage_fees],
    ['is_super_admin', is_super_admin],
    ['is_admin', is_admin],
  ]) {
    const err = validateOptionalBoolean(value, field);
    if (err) {
      return sendJson(res, 400, { success: false, message: err, data: null });
    }
  }
  if (password !== undefined && password !== null && String(password).trim() === '') {
    return sendJson(res, 400, {
      success: false,
      message: 'password cannot be empty when provided',
      data: null,
    });
  }
  next();
}

export function validateUserIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, {
      success: false,
      message: 'Valid user id (UUID) is required',
      data: null,
    });
  }
  next();
}

export function validateGetUsersQuery(req, res, next) {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const limit = limitRaw === undefined ? 10 : Number(limitRaw);
  if (!Number.isInteger(page) || page < 1) {
    return sendJson(res, 400, {
      success: false,
      message: 'page must be an integer >= 1',
      data: null,
    });
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return sendJson(res, 400, {
      success: false,
      message: 'limit must be an integer >= 1',
      data: null,
    });
  }
  req.validatedQuery = {
    page,
    limit,
    search:
      req.query.search === undefined || req.query.search === null || req.query.search === ''
        ? null
        : String(req.query.search),
  };
  next();
}
