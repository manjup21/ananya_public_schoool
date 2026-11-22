import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load backend/.env regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_PROD_CORS_ORIGINS = [
  'https://ananyapublicschool.edudisk.in',
];

function parseProdCorsOrigins() {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_PROD_CORS_ORIGINS;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 5000,
  apiPrefix: process.env.API_PREFIX ?? '/api',
  databaseUrl: process.env.DATABASE_URL ?? '',
  pg: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER ?? '',
    password: process.env.PGPASSWORD ?? '',
    database: process.env.PGDATABASE ?? '',
    ssl:
      process.env.PGSSL === 'true'
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'atr_token',
  },
  aes: {
    keyBase64: process.env.AES_KEY_BASE64 ?? '',
  },
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY ?? '',
    integratedNumber: process.env.MSG91_INTEGRATED_NUMBER ?? '',
    namespace: process.env.MSG91_WHATSAPP_NAMESPACE ?? '',
    whatsappAttendanceTemplate: process.env.MSG91_WHATSAPP_ATTENDANCE_TEMPLATE ?? '',
    whatsappExamTemplate: process.env.MSG91_WHATSAPP_EXAM_TEMPLATE ?? '',
    whatsappFeeDueTemplate: process.env.MSG91_WHATSAPP_FEE_DUE_TEMPLATE ?? '',
  },
  schoolName: process.env.SCHOOL_NAME ?? 'School',
  schoolPhone: process.env.SCHOOL_PHONE ?? '',
  uploadDir: process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '../../uploads'),
  cors: {
    origins: parseProdCorsOrigins(),
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    login: {
      max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
      windowMs: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 15 * 60 * 1000,
    },
    api: {
      max: Number(process.env.RATE_LIMIT_API_MAX) || 300,
      windowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS) || 15 * 60 * 1000,
    },
  },
};
