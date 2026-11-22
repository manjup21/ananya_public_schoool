import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './utils/env.js';
import { apiRouter } from './routes/index.js';
import { MESSAGES } from './constants/messages.js';
import { apiRateLimiter } from './middleware/rateLimit.middleware.js';

export function createApp() {
  const app = express();

  // Required when behind Nginx/reverse proxy so rate limits use the real client IP.
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: (origin, cb) => {
        // Non-browser clients (curl, health checks) send no Origin header.
        if (!origin) return cb(null, true);
        // Dev: allow all origins. Production: allowlist only.
        if (env.nodeEnv !== 'production') return cb(null, true);
        if (env.cors.origins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Edu ERP API',
      data: { service: 'edu-erp-api', health: `${env.apiPrefix}/health` },
    });
  });

  app.use(env.apiPrefix, apiRateLimiter, apiRouter);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: MESSAGES.common.notFound,
      data: null,
    });
  });

  app.use((err, req, res, next) => {
    const status = err.status ?? 500;
    console.error(`[${req.method} ${req.originalUrl}] ${status}:`, err.message || err);
    if (status >= 500) console.error(err.stack);
    res.status(status).json({
      success: false,
      message:
        env.nodeEnv === 'production' ? MESSAGES.common.internalServerError : (err.message ?? 'Error'),
      data: null,
    });
  });

  return app;
}
