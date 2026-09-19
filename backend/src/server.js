import { env } from './config/env.js';
import app from './app.js';

const server = app.listen(env.port, () => {
  console.log(`API listening on port ${env.port} (${env.nodeEnv}).`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing API server.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
