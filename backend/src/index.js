import { createApp } from './app.js';
import { env } from './utils/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}${env.apiPrefix}/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${env.port} is already in use. Change PORT in .env or stop the other process:\n` +
        `  netstat -ano | findstr :${env.port}`
    );
    process.exit(1);
  }
  console.error('[Server error]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  process.exit(1);
});
