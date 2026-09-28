import { env } from './src/config/env.js';
import { createApp } from './src/app.js';

const app = createApp();

// Render (and most hosts) assign the port through PORT; bind every interface.
const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`[shere-music] API listening on port ${env.port} (${env.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`[shere-music] ${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[shere-music] Unhandled promise rejection:', reason);
});
